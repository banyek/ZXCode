"""Verify native source escape/REM behavior by original-ROM cassette LOAD/RUN."""
import argparse
import hashlib
import json
import subprocess
import sys
from importlib.metadata import version
from pathlib import Path
from skoolkit import ROM48, sna2img
from skoolkit.snapshot import Snapshot

ROOT = Path(__file__).resolve().parents[2]
ROM_HASH = "d55daa439b673b0e3f5897f99ac37ecb45f974d1862b4dadb85dec34af99cb42"


def verify(output):
    if version("skoolkit") != "10.1":
        raise RuntimeError("Use SkoolKit 10.1")
    rom = Path(ROM48).read_bytes()
    if hashlib.sha256(rom).hexdigest() != ROM_HASH:
        raise RuntimeError("Unexpected ROM")
    output.mkdir(parents=True, exist_ok=True)
    tape, snapshot_file = output / "escapes.tap", output / "escapes.z80"
    source = ROOT / "examples/escapes.bas"
    built = subprocess.run(["node", str(ROOT / "packages/cli/bin/zxcode.mjs"), "build", str(source), "--output", str(tape)], capture_output=True, text=True, timeout=30)
    if built.returncode:
        raise RuntimeError(built.stderr)
    raw = tape.read_bytes()
    blocks = []
    cursor = 0
    while cursor < len(raw):
        length = int.from_bytes(raw[cursor:cursor + 2], "little")
        block = raw[cursor + 2:cursor + 2 + length]
        parity = 0
        for byte in block:
            parity ^= byte
        if len(block) != length or length < 2 or parity:
            raise AssertionError("Invalid TAP framing/checksum")
        blocks.append(block)
        cursor += 2 + length
    if cursor != len(raw) or len(blocks) != 2 or blocks[0][:2] != b"\0\0" or blocks[1][0] != 255:
        raise AssertionError("Unexpected BASIC TAP layout")
    program = blocks[1][1:-1]
    # Independently composed: REM space, NUL/CR/FF/STOP, final CR; then LET a$ with
    # UDG A, block 15 and one doubled quote data byte. Neither image uses ZXCode.
    expected_prefix = bytes.fromhex("000a0700ea20000dffe20d00140b00f161243d22908f2222220d")
    if not program.startswith(expected_prefix):
        raise AssertionError("Escaped first-line images differ from independent bytes")
    command = [sys.executable, "-c", "import sys; from skoolkit import tap2sna; tap2sna.main(sys.argv[1:])", "-c", 'load=LOAD "" : RUN', "-c", "machine=48", "-c", "fast-load=0", "-c", "accelerator=none", "-c", "accelerate-dec-a=0", "-c", "finish-tape=1", "-c", "timeout=60", "-s", "0x12ac", str(tape), str(snapshot_file)]
    emulated = subprocess.run(command, capture_output=True, text=True, timeout=90)
    (output / "emulator.log").write_text(emulated.stdout + emulated.stderr)
    if emulated.returncode or "timed out" in emulated.stdout or "PC=4780" not in emulated.stdout:
        raise AssertionError("ROM execution failed; inspect emulator.log")
    snapshot = Snapshot.get(str(snapshot_file))
    ram = snapshot.ram()
    if snapshot.pc != 0x12AC or len(ram) != 49152:
        raise AssertionError("Unexpected machine state")
    address = ram[0x5C53 - 0x4000] + 256 * ram[0x5C54 - 0x4000]
    if bytes(ram[address - 0x4000:address - 0x4000 + len(program)]) != program:
        raise AssertionError("Loaded program bytes changed")
    font = {bytes(rom[0x3C00 + code * 8:0x3C00 + code * 8 + 8]): chr(code) for code in range(32, 128)}
    rows = []
    for row in range(24):
        text = "".join(font.get(bytes(ram[(row // 8) * 2048 + (row % 8) * 32 + col + pixel * 256] for pixel in range(8)), "?") for col in range(32)).rstrip()
        if text:
            rows.append({"row": row, "text": text})
    ink = ram[0x5800 - 0x4000] & 7
    if {"row": 0, "text": "ESCAPES OK"} not in rows or {"row": 23, "text": "0 OK, 40:1"} not in rows or ram[0x5C3A - 0x4000] != 255 or ink != 2:
        raise AssertionError(("Unexpected runtime results", rows, ink))
    sna2img.main(["--scale", "2", str(snapshot_file), str(output / "escapes.png")])
    evidence = {"emulator": "SkoolKit 10.1, original 48K ROM", "romSha256": ROM_HASH, "sourceSha256": hashlib.sha256(source.read_bytes()).hexdigest(), "tapSha256": hashlib.sha256(raw).hexdigest(), "independentProgramPrefix": expected_prefix.hex(), "completionPc": "0x12ac", "screenRows": rows, "firstCellInk": ink, "fastLoad": False, "loaderAccelerators": False}
    (output / "evidence.json").write_text(json.dumps(evidence, indent=2) + "\n")
    print("Verified original ROM: raw CR/STOP in REM skipped; UDG/block/quote CODE values; red ESCAPES OK; 0 OK, 40:1")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", type=Path, required=True)
    verify(parser.parse_args().output_dir.resolve())
