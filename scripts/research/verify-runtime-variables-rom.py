"""Reproduce runtime variable bytes with zmakebas and original ROM; never imports ZXCode."""
import argparse
import hashlib
import json
import subprocess
import sys
from importlib.metadata import version
from pathlib import Path
from skoolkit import ROM48
from skoolkit.snapshot import Snapshot

ROOT = Path(__file__).resolve().parents[2]
ROM_HASH = "d55daa439b673b0e3f5897f99ac37ecb45f974d1862b4dadb85dec34af99cb42"


def main(args):
    if version("skoolkit") != "10.1" or hashlib.sha256(Path(ROM48).read_bytes()).hexdigest() != ROM_HASH:
        raise RuntimeError("Use pinned SkoolKit/original ROM")
    commit=subprocess.run(["git","-C",str(args.zmakebas.resolve().parent),"rev-parse","HEAD"],check=True,capture_output=True,text=True,timeout=10).stdout.strip()
    if commit!="667090faf392e0083bbcf238084dcdd996957285":
        raise RuntimeError("Use zmakebas built from the pinned source checkout")
    source = ROOT / "examples/debug/runtime-variables.zxbas"
    output = args.output_dir.resolve()
    output.mkdir(parents=True,exist_ok=False)
    tape,snapshot_file = output / "variables.tap",output / "variables.z80"
    subprocess.run([str(args.zmakebas.resolve()),"-o",str(tape),"-a","10","-n","VARS",str(source)],check=True,capture_output=True,text=True,timeout=30)
    command = [sys.executable,"-c","import sys;from skoolkit import tap2sna;tap2sna.main(sys.argv[1:])","-c",'load=LOAD ""',"-c","machine=48","-c","fast-load=0","-c","accelerator=none","-c","accelerate-dec-a=0","-c","finish-tape=1","-c","timeout=60","-s","0x12ac",str(tape),str(snapshot_file)]
    loaded = subprocess.run(command,capture_output=True,text=True,timeout=90)
    (output / "load.log").write_text(loaded.stdout+loaded.stderr)
    if loaded.returncode or "timed out" in loaded.stdout:
        raise AssertionError("Original ROM LOAD/RUN failed")
    snapshot = Snapshot.get(str(snapshot_file))
    memory = bytes(snapshot.ram())
    word = lambda address:memory[address-0x4000]+256*memory[address-0x4000+1]
    start,end = word(0x5C4B),word(0x5C59)
    if memory[0x5C3A-0x4000] != 8 or not 0x4000<=start<end<=0xFFFF:
        raise AssertionError("Expected successful assignments and STOP")
    report = {"schemaVersion":1,"reference":"zmakebas 1.3.3 commit 667090faf392e0083bbcf238084dcdd996957285 plus SkoolKit 10.1/original 48K ROM","romSha256":ROM_HASH,"sourceSha256":hashlib.sha256(source.read_bytes()).hexdigest(),"variablesAddress":start,"editLineAddress":end,"variablesHex":memory[start-0x4000:end-0x4000].hex(),"reportCode":9}
    (output / "report.json").write_text(json.dumps(report,indent=2)+"\n")
    if args.capture:
        target=args.capture.resolve()
        if target.is_relative_to(ROOT):
            raise ValueError("Independent capture goes outside the repository for explicit review before adding a fixture")
        target.write_text(json.dumps(report,indent=2)+"\n")
    else:
        expected=json.loads((ROOT / "tests/fixtures/runtime-variables-rom.json").read_text())
        if report!=expected:
            raise AssertionError("Original-ROM runtime bytes differ from the reviewed fixture")
    print("Verified independent original-ROM numeric/string/array/FOR variable image; no ZXCode implementation used")


if __name__ == "__main__":
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--zmakebas",type=Path,required=True)
    parser.add_argument("--output-dir",type=Path,required=True)
    parser.add_argument("--capture",type=Path)
    main(parser.parse_args())
