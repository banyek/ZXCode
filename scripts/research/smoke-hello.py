"""Build with ZXCode, then verify loading/execution in independent 48K emulation."""
import argparse
import hashlib
import json
import subprocess
import sys
import tempfile
from importlib.metadata import version
from pathlib import Path

from skoolkit import ROM48, sna2img
from skoolkit.snapshot import Snapshot

ROOT = Path(__file__).resolve().parents[2]


def golden(name):
    return bytes.fromhex((ROOT / "tests/fixtures" / name).read_text())


def verify(output):
    if version("skoolkit") != "10.1":
        raise RuntimeError("Use the pinned reference emulator: SkoolKit 10.1")
    rom = Path(ROM48).read_bytes()
    rom_hash = hashlib.sha256(rom).hexdigest()
    expected_hash = json.loads((ROOT / "tests/fixtures/numeric-rom.json").read_text())["romSha256"]
    if len(rom) != 16384 or rom_hash != expected_hash:
        raise RuntimeError("Unexpected ROM image")
    output.mkdir(parents=True, exist_ok=True)
    tape, snapshot_file = output / "hello.tap", output / "hello.z80"
    built = subprocess.run(["node", str(ROOT / "packages/cli/bin/zxcode.mjs"), "build", str(ROOT / "examples/hello.bas"), "--output", str(tape)], capture_output=True, text=True, timeout=30)
    if built.returncode != 0:
        raise RuntimeError("ZXCode build failed: " + built.stderr)
    if tape.read_bytes() != golden("hello.tap.hex"):
        raise AssertionError("Generated TAP disagrees with independent golden")
    command = [sys.executable, "-c", "import sys; from skoolkit import tap2sna; tap2sna.main(sys.argv[1:])",
               "-c", 'load=LOAD "" : RUN', "-c", "machine=48", "-c", "fast-load=0",
               "-c", "accelerator=none", "-c", "accelerate-dec-a=0", "-c", "finish-tape=1",
               "-c", "timeout=60", "-s", "0x12ac", str(tape), str(snapshot_file)]
    emulated = subprocess.run(command, capture_output=True, text=True, timeout=90)
    (output / "emulator.log").write_text(emulated.stdout + emulated.stderr)
    if emulated.returncode != 0 or "timed out" in emulated.stdout or "PC=4780" not in emulated.stdout:
        raise AssertionError("Reference load did not complete; inspect emulator.log")
    snapshot = Snapshot.get(str(snapshot_file))
    ram = snapshot.ram()
    if snapshot.pc != 0x12AC or len(ram) != 49152:
        raise AssertionError("Unexpected reference completion state")

    def word(address):
        return ram[address - 0x4000] + 256 * ram[address + 1 - 0x4000]

    program = word(0x5C53)
    expected_program = golden("hello-program.hex")
    if not 0x4000 <= program <= 0x10000 - len(expected_program):
        raise AssertionError("Invalid live PROG pointer")
    if bytes(ram[program - 0x4000:program - 0x4000 + len(expected_program)]) != expected_program:
        raise AssertionError("ROM-loaded BASIC image disagrees with independent bytes")
    # Font base is CHARS' initial 3C00h: the space glyph (code 32) is at 3D00h.
    font = {bytes(rom[0x3C00 + code * 8:0x3C00 + code * 8 + 8]): chr(code) for code in range(32, 127)}
    rows = []
    for row in range(24):
        text = "".join(font.get(bytes(ram[(row // 8) * 2048 + (row % 8) * 32 + col + pixel * 256] for pixel in range(8)), "?") for col in range(32)).rstrip()
        if text:
            rows.append({"row": row, "text": text})
    if {"row": 0, "text": "HELLO WORLD"} not in rows:
        raise AssertionError("HELLO WORLD is absent from actual screen bitmap cells")
    if ram[0x5C3A - 0x4000] != 255 or {"row": 23, "text": "0 OK, 10:1"} not in rows:
        raise AssertionError("ROM did not report successful BASIC completion")
    sna2img.main(["--scale", "2", str(snapshot_file), str(output / "hello.png")])
    evidence = {"emulator": "SkoolKit 10.1, original 48K ROM", "romSha256": rom_hash,
                "tapSha256": hashlib.sha256(tape.read_bytes()).hexdigest(), "programAddress": program,
                "completionPc": "0x12ac", "screenRows": rows, "fastLoad": False, "loaderAccelerators": False}
    (output / "evidence.json").write_text(json.dumps(evidence, indent=2) + "\n")
    print("Verified: independent TAP bytes -> original ROM LOAD/RUN -> HELLO WORLD -> 0 OK, 10:1")
    return evidence


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", type=Path, help="Retain TAP, snapshot, log, screenshot and evidence here")
    options = parser.parse_args()
    if options.output_dir:
        verify(options.output_dir.resolve())
        print("Evidence:", options.output_dir.resolve())
    else:
        with tempfile.TemporaryDirectory(prefix="zxcode-m1-proof-") as directory:
            verify(Path(directory))


if __name__ == "__main__":
    main()
