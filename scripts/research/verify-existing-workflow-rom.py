"""Verify the actual installed-editor M7 acceptance artifacts under the original ROM."""
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


def main(evidence):
    if version("skoolkit") != "10.1":
        raise RuntimeError("Use SkoolKit 10.1")
    rom = Path(ROM48).read_bytes()
    if hashlib.sha256(rom).hexdigest() != ROM_HASH:
        raise RuntimeError("Unexpected ROM")
    report = json.loads((evidence / "report.json").read_text())
    if report["status"] != "passed" or not report["nativeCommandsVerified"]:
        raise AssertionError("Native installed-editor acceptance must pass first")
    original = (evidence / "existing-original.tap").read_bytes()
    if original != (evidence / "existing-preserved.tap").read_bytes():
        raise AssertionError("Preserved rebuild differs from original")
    results = []
    for label, final_line, expected_hash in [("original", 100, report["originalTapSha256"]), ("transformed", 1000, report["transformedTapSha256"])]:
        tape = evidence / f"existing-{label}.tap"
        if hashlib.sha256(tape.read_bytes()).hexdigest() != expected_hash:
            raise AssertionError("Native acceptance tape changed")
        snapshot_file = evidence / f"existing-{label}.z80"
        command = [sys.executable, "-c", "import sys; from skoolkit import tap2sna; tap2sna.main(sys.argv[1:])",
                   "-c", 'load=LOAD "" : CLS : RUN', "-c", "machine=48", "-c", "fast-load=0", "-c", "accelerator=none",
                   "-c", "accelerate-dec-a=0", "-c", "finish-tape=1", "-c", "timeout=60", "-s", "0x12ac", str(tape), str(snapshot_file)]
        process = subprocess.run(command, capture_output=True, text=True, timeout=90)
        (evidence / f"existing-{label}-rom.log").write_text(process.stdout + process.stderr)
        if process.returncode or "timed out" in process.stdout or "PC=4780" not in process.stdout:
            raise AssertionError(f"ROM execution failed: {label}")
        snapshot = Snapshot.get(str(snapshot_file))
        ram = bytes(snapshot.ram())
        if snapshot.pc != 0x12AC or len(ram) != 49152 or ram[0x5C3A-0x4000] != 255:
            raise AssertionError("Unexpected ROM completion")
        font = {bytes(rom[0x3C00+code*8:0x3C00+code*8+8]): chr(code) for code in range(32,128)}
        rows = []
        for row in range(24):
            text = "".join(font.get(bytes(ram[(row//8)*2048+(row%8)*32+col+pixel*256] for pixel in range(8)), "?") for col in range(32)).rstrip()
            if text:
                rows.append(text)
        if rows != ["36wo", "CORE OK", f"0 OK, {final_line}:1"]:
            raise AssertionError((label, rows))
        results.append({"case":label,"screenRows":rows,"tapSha256":expected_hash,"screenSha256":hashlib.sha256(ram[:6912]).hexdigest()})
    result = {"schemaVersion":1,"status":"passed","emulator":"SkoolKit 10.1","romSha256":ROM_HASH,"fastLoad":False,"loaderAccelerators":False,"preservedTapIdentical":True,"semanticNormalization":"renumbered ROM completion line 100 to 1000; program assertions and visible results unchanged","cases":results}
    (evidence / "rom-report.json").write_text(json.dumps(result, indent=2)+"\n")
    print("Verified actual editor workflow: preserved tape identical; native renumber/format rebuild executes CORE OK with expected new line number")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--evidence-dir", type=Path, required=True)
    main(parser.parse_args().evidence_dir.resolve())
