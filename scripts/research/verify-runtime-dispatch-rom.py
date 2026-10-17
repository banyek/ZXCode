"""Observe original 48K ROM statement dispatch; no product debugger promise."""
import argparse
import hashlib
import json
import subprocess
import sys
from importlib.metadata import version
from pathlib import Path
from skoolkit import ROM48
from skoolkit.snapshot import Snapshot
from skoolkit.simutils import from_snapshot
from skoolkit.simulator import Simulator

ROOT = Path(__file__).resolve().parents[2]
ROM_HASH = "d55daa439b673b0e3f5897f99ac37ecb45f974d1862b4dadb85dec34af99cb42"
EXPECTED = [(10, 1), (10, 2), (20, 1), (20, 2), (100, 1), (100, 2), (20, 3), (30, 1), (40, 1), (20, 1), (30, 1), (30, 2), (40, 1), (50, 1), (200, 1), (210, 1), (210, 2)]


def observe(snapshot):
    simulator = from_snapshot(Simulator, snapshot)
    memory = simulator.memory
    def word(address):
        return memory[address] + 256*memory[address+1]
    def state():
        return {"line":word(0x5C45),"statement":memory[0x5C47],"flags":memory[0x5C3B],"programBase":word(0x5C53),"characterAddress":word(0x5C5D),"nextLineAddress":word(0x5C55),"pendingLine":word(0x5C42),"pendingStatement":memory[0x5C44]}
    dispatch, before_increment, returns = [], [], []
    for instruction in range(2_000_000):
        pc = simulator.registers[24]
        if pc in (0x1B29, 0x1B3D, 0x1B76):
            item = state()
            if item["line"] < 10000 and item["flags"] & 128:
                if pc == 0x1B29:
                    before_increment.append(item)
                elif pc == 0x1B76:
                    returns.append(item)
                else:
                    address = item["characterAddress"]
                    if not item["programBase"] <= address < word(0x5C4B):
                        raise AssertionError("Dispatch character outside current stored program")
                    item["commandByte"] = memory[address]
                    item["programOffset"] = address-item["programBase"]
                    if not 0xCE <= item["commandByte"] <= 0xFF:
                        raise AssertionError("Dispatch is not at an original ROM command token")
                    dispatch.append(item)
        if dispatch and pc == 0x12AC:
            if memory[0x5C3A] != 8 or word(0x5C45) != 210 or memory[0x5C47] != 3:
                raise AssertionError("Expected STOP report with continuation at 210:3")
            break
        simulator.run()
    else:
        raise AssertionError("Runtime observation instruction budget exceeded")
    actual = [(item["line"],item["statement"]) for item in dispatch]
    if actual != EXPECTED:
        raise AssertionError((actual,EXPECTED))
    if not any(item["line"] == 20 and item["statement"] == 2 and item["pendingLine"] == 100 and item["pendingStatement"] == 0 for item in returns):
        raise AssertionError("GO SUB pending transfer not observed")
    if not any(item["line"] == 100 and item["statement"] == 2 and item["pendingLine"] == 20 and item["pendingStatement"] == 3 for item in returns):
        raise AssertionError("RETURN statement continuation not observed")
    return {"dispatch":dispatch,"beforeIncrement":before_increment,"statementReturns":returns,"executedInstructions":instruction,"completion":{"report":"9 STOP statement","line":210,"stoppedStatement":2,"continuationStatement":3}}


def main(output):
    if version("skoolkit") != "10.1":
        raise RuntimeError("Use SkoolKit 10.1")
    rom = Path(ROM48).read_bytes()
    if hashlib.sha256(rom).hexdigest() != ROM_HASH or rom[0x1B3D:0x1B41] != bytes.fromhex("21761be5"):
        raise RuntimeError("Unexpected original ROM/dispatch instructions")
    output.mkdir(parents=True,exist_ok=False)
    source = ROOT / "examples/debug/runtime-dispatch.zxbas"
    tape, snapshot_file = output / "runtime.tap", output / "start.z80"
    subprocess.run(["node",str(ROOT / "packages/cli/bin/zxcode.mjs"),"build",str(source),"--output",str(tape),"--name","TRACE"],capture_output=True,text=True,check=True,timeout=30)
    command = [sys.executable,"-c","import sys; from skoolkit import tap2sna; tap2sna.main(sys.argv[1:])","-c",'load=LOAD "" : RUN',"-c","machine=48","-c","fast-load=0","-c","accelerator=none","-c","accelerate-dec-a=0","-c","finish-tape=1","-c","timeout=60","-s","0x1b3d",str(tape),str(snapshot_file)]
    process = subprocess.run(command,capture_output=True,text=True,timeout=90)
    (output / "load.log").write_text(process.stdout+process.stderr)
    if process.returncode or "timed out" in process.stdout:
        raise AssertionError("ROM cassette load failed")
    snapshot = Snapshot.get(str(snapshot_file))
    first, second = observe(snapshot), observe(snapshot)
    if first != second:
        raise AssertionError("Repeated runtime observations differ")
    report = {"schemaVersion":1,"romSha256":ROM_HASH,"emulator":"SkoolKit 10.1","sourceSha256":hashlib.sha256(source.read_bytes()).hexdigest(),"tapSha256":hashlib.sha256(tape.read_bytes()).hexdigest(),"dispatchPc":"0x1b3d","repeatedRuns":2,"trace":first,"scope":"interpreter-state research; no source-breakpoint or external-backend guarantee"}
    (output / "report.json").write_text(json.dumps(report,indent=2)+"\n")
    print("Verified 17 original-ROM dispatches twice: colon/IF/loop/GO TO/GO SUB/RETURN; pending transfer and continuation state observed")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir",type=Path,required=True)
    main(parser.parse_args().output_dir.resolve())
