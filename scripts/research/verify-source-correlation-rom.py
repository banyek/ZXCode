"""Prove shared source maps against relocated original-ROM and live ZRCP dispatches."""
import argparse
import hashlib
import importlib.util
import json
import re
import socket
import subprocess
import sys
import time
from importlib.metadata import version
from pathlib import Path
from types import SimpleNamespace
from skoolkit import ROM48
from skoolkit.snapshot import Snapshot, write_snapshot
from skoolkit.simutils import from_snapshot, get_state, IYh, IYl
from skoolkit.simulator import Simulator

ROOT = Path(__file__).resolve().parents[2]
ROM_HASH = "d55daa439b673b0e3f5897f99ac37ecb45f974d1862b4dadb85dec34af99cb42"
spec = importlib.util.spec_from_file_location("runtime_dispatch",ROOT / "scripts/research/verify-runtime-dispatch-rom.py")
runtime = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runtime)


def word(memory,address):
    return memory[address]+256*memory[address+1]


def relocate(simulator,amount):
    if not amount:
        return
    memory = simulator.memory
    before = word(memory,0x5C53)
    image = bytes(memory[before:word(memory,0x5C4B)])
    # Original ROM allocator updates its own pointer table and moves the program.
    memory[0xFC00:0xFC02] = [255,255]
    allocator = Simulator(memory,{"PC":0x1655,"SP":0xFC00,"HL":before-1,"BC":amount,"IY":0x5C3A})
    for _ in range(100000):
        if allocator.registers[24] == 0xFFFF:
            break
        allocator.run()
    else:
        raise AssertionError("Original ROM allocator exceeded budget")
    after = word(memory,0x5C53)
    if after != before+amount or bytes(memory[after:word(memory,0x5C4B)]) != image:
        raise AssertionError("ROM relocation did not preserve the complete program")


def observation(manifest,pc,iy,flags,sysvars,program):
    base = 0x5C42
    get = lambda address: sysvars[address-base]
    getword = lambda address: get(address)+256*get(address+1)
    return {"romSha256":ROM_HASH,"pc":pc,"iy":iy,"flags":flags,
            "sourceVersion":manifest["sourceVersion"],"sourceSha256":manifest["sourceSha256"],
            "programBase":getword(0x5C53),"variablesAddress":getword(0x5C4B),"characterAddress":getword(0x5C5D),
            "programHex":bytes(program).hex(),"line":getword(0x5C45),"statement":get(0x5C47)}


def simulate(snapshot,manifest,amount):
    simulator = from_snapshot(Simulator,snapshot)
    relocate(simulator,amount)
    memory = simulator.memory
    program_base = word(memory,0x5C53)
    observations = []
    for _ in range(2_000_000):
        pc = simulator.registers[24]
        if pc == 0x1B3D and word(memory,0x5C45)<10000 and memory[0x5C3B]&128:
            item = observation(manifest,pc,simulator.registers[IYl]+256*simulator.registers[IYh],memory[0x5C3B],memory[0x5C42:0x5C5F],memory[word(memory,0x5C53):word(memory,0x5C4B)])
            observations.append(item)
        if observations and pc == 0x12AC:
            if memory[0x5C3A] != 8:
                raise AssertionError("Expected original program STOP")
            break
        simulator.run()
    else:
        raise AssertionError("Original ROM runtime instruction budget exceeded")
    if [(item["line"],item["statement"]) for item in observations] != runtime.EXPECTED:
        raise AssertionError("Relocated dispatch control flow changed")
    return {"backend":"skoolkit-original-rom","programBase":program_base,"observations":observations}


def external(executable,snapshot_files,manifest,output):
    with socket.socket() as reserved:
        reserved.bind(("127.0.0.1",0))
        port = reserved.getsockname()[1]
    args = [str(executable),"--noconfigfile","--machine","48k","--vo","null","--ao","null","--nowelcomemessage","--nosplash","--stats-send-already-asked","--stats-disable-check-updates","--stats-disable-check-yesterday-users","--enable-remoteprotocol","--remoteprotocol-port",str(port),"--remoteprotocol-prompt","zxcode-map","--exit-after","45"]
    runs = []
    with (output / "zrcp-process.log").open("w") as log:
        process = subprocess.Popen(args,cwd=executable.parent,stdout=log,stderr=subprocess.STDOUT)
        connection = None
        try:
            deadline = time.monotonic()+5
            while time.monotonic()<deadline:
                try:
                    connection = socket.create_connection(("127.0.0.1",port),timeout=.2)
                    break
                except OSError:
                    if process.poll() is not None:
                        raise RuntimeError("Owned emulator exited")
                    time.sleep(.05)
            if connection is None:
                raise TimeoutError("Loopback listener unavailable")
            connection.settimeout(5)
            def read():
                data = b""
                while not re.search(rb"\nzxcode-map(?:@cpu-step)?> $",data):
                    block = connection.recv(65536)
                    if not block:
                        raise RuntimeError("Protocol disconnected")
                    data += block
                    if len(data)>1048576:
                        raise RuntimeError("Response too large")
                return data.decode("ascii").split("\nzxcode-map")[0]
            def command(text):
                connection.sendall((text+"\n").encode("ascii"))
                reply = read()
                if "Error." in reply:
                    raise AssertionError((text,reply))
                return reply
            read()
            if command("get-version").strip() != "13.0":
                raise AssertionError("Expected pinned 13.0")
            command("enter-cpu-step")
            for snapshot_file in snapshot_files:
                command("snapshot-load "+str(snapshot_file))
                if hashlib.sha256(bytes.fromhex(command("read-memory 0 16384").strip())).hexdigest() != ROM_HASH:
                    raise AssertionError("External active ROM mismatch")
                command("enable-breakpoints")
                command("set-breakpoint 1 PC=6973")
                command("enable-breakpoint 1")
                observations = []
                for _ in range(len(runtime.EXPECTED)):
                    command("run 1000000")
                    registers = command("get-registers")
                    pc = int(re.search(r"\bPC=([0-9a-fA-F]{4})",registers)[1],16)
                    iy = int(re.search(r"\bIY=([0-9a-fA-F]{4})",registers)[1],16)
                    system = bytes.fromhex(command("read-memory 23618 29").strip())
                    flags = bytes.fromhex(command("read-memory 23611 1").strip())[0]
                    base = word(system,0x5C53-0x5C42)
                    end = word(system,0x5C4B-0x5C42)
                    if end-base != len(manifest["programHex"])//2:
                        raise AssertionError("External program extent mismatch")
                    program = bytes.fromhex(command(f"read-memory {base} {end-base}").strip())
                    item = observation(manifest,pc,iy,flags,system,program)
                    observations.append(item)
                if [(item["line"],item["statement"]) for item in observations] != runtime.EXPECTED:
                    raise AssertionError("External dispatch sequence differs")
                command("set-breakpoint 1 PC=4780")
                command("enable-breakpoint 1")
                command("run 1000000")
                if bytes.fromhex(command("read-memory 23610 1").strip()) != b"\x08":
                    raise AssertionError("External original-ROM STOP not observed")
                runs.append({"backend":"zesarux-zrcp-loopback-research","programBase":observations[0]["programBase"],"observations":observations})
            connection.sendall(b"exit-emulator\n")
            connection.close()
            connection = None
            process.wait(timeout=5)
            if process.returncode:
                raise AssertionError("External emulator exit failed")
            return runs
        finally:
            if connection is not None:
                connection.close()
            if process.poll() is None:
                process.terminate()
                try:
                    process.wait(timeout=3)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait(timeout=3)


def main(output,zesarux):
    if version("skoolkit") != "10.1" or hashlib.sha256(Path(ROM48).read_bytes()).hexdigest() != ROM_HASH:
        raise RuntimeError("Use pinned SkoolKit/original ROM")
    output.mkdir(parents=True,exist_ok=False)
    subprocess.run(["node",str(ROOT / "scripts/research/runtime-correlation.mjs"),"prepare",str(output)],check=True,timeout=30)
    manifest = json.loads((output / "manifest.json").read_text())
    snapshot_file = output / "start.z80"
    command = [sys.executable,"-c","import sys; from skoolkit import tap2sna; tap2sna.main(sys.argv[1:])","-c",'load=LOAD "" : RUN',"-c","machine=48","-c","fast-load=0","-c","accelerator=none","-c","accelerate-dec-a=0","-c","finish-tape=1","-c","timeout=60","-s","0x1b3d",str(output / "runtime.tap"),str(snapshot_file)]
    loaded = subprocess.run(command,capture_output=True,text=True,timeout=90)
    (output / "load.log").write_text(loaded.stdout+loaded.stderr)
    if loaded.returncode or "timed out" in loaded.stdout:
        raise AssertionError("Original-ROM tape load failed")
    snapshot = Snapshot.get(str(snapshot_file))
    runs = []
    for amount in [0,64,257]:
        first, second = simulate(snapshot,manifest,amount),simulate(snapshot,manifest,amount)
        if first != second:
            raise AssertionError("Repeated relocated runs differ")
        runs.append(first)
    if zesarux is not None:
        relocated = from_snapshot(Simulator,snapshot)
        relocate(relocated,257)
        relocated.set_tracer(SimpleNamespace(border=7,outfe=0))
        relocated_file = output / "relocated.z80"
        write_snapshot(str(relocated_file),*get_state(relocated))
        runs.extend(external(zesarux,[snapshot_file,relocated_file],manifest,output))
    (output / "observations.json").write_text(json.dumps({"schemaVersion":1,"runs":runs},indent=2)+"\n")
    subprocess.run(["node",str(ROOT / "scripts/research/runtime-correlation.mjs"),"verify",str(output)],check=True,timeout=30)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir",type=Path,required=True)
    parser.add_argument("--zesarux",type=Path,help="Only the explicitly loopback-bound 13.0 research build")
    args = parser.parse_args()
    main(args.output_dir.resolve(),args.zesarux.resolve() if args.zesarux else None)
