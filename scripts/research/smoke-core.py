"""Load and execute the combined arrays/DATA/FN/channel corpus in original ROM."""
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
    fixture = json.loads((ROOT / "tests/fixtures/core-corpus.json").read_text())
    case = next(case for case in fixture["cases"] if case["name"] == "arrays-functions")
    expected = bytes.fromhex(case["programHex"])
    output.mkdir(parents=True, exist_ok=True)
    tape, snapshot_file = output / "core.tap", output / "core.z80"
    command = ["node", str(ROOT / "packages/cli/bin/zxcode.mjs"), "build", str(ROOT / case["sourcePath"]), "--output", str(tape), "--name", "core"]
    built = subprocess.run(command, capture_output=True, text=True, timeout=30)
    if built.returncode != 0:
        raise RuntimeError(built.stderr)
    # TAP block lengths and checksums are verified independently of the writer.
    tape_bytes = tape.read_bytes()
    cursor = 0
    blocks = []
    while cursor < len(tape_bytes):
        length = int.from_bytes(tape_bytes[cursor:cursor + 2], "little")
        block = tape_bytes[cursor + 2:cursor + 2 + length]
        checksum = 0
        for byte in block:
            checksum ^= byte
        if len(block) != length or checksum != 0:
            raise AssertionError("Invalid TAP block")
        blocks.append(block)
        cursor += 2 + length
    if cursor != len(tape_bytes) or len(blocks) != 2 or blocks[0][:2] != b"\x00\x00" or blocks[1][0] != 255 or blocks[1][1:-1] != expected:
        raise AssertionError("TAP program differs from independent image")
    command = [sys.executable, "-c", "import sys; from skoolkit import tap2sna; tap2sna.main(sys.argv[1:])", "-c", 'load=LOAD "" : RUN', "-c", "machine=48", "-c", "fast-load=0", "-c", "accelerator=none", "-c", "accelerate-dec-a=0", "-c", "finish-tape=1", "-c", "timeout=60", "-s", "0x12ac", str(tape), str(snapshot_file)]
    emulated = subprocess.run(command, capture_output=True, text=True, timeout=90)
    (output / "emulator.log").write_text(emulated.stdout + emulated.stderr)
    if emulated.returncode != 0 or "timed out" in emulated.stdout or "PC=4780" not in emulated.stdout:
        raise AssertionError("ROM execution did not finish; inspect emulator.log")
    snapshot = Snapshot.get(str(snapshot_file))
    ram = snapshot.ram()
    if snapshot.pc != 0x12AC or len(ram) != 49152:
        raise AssertionError("Unexpected machine state")

    def word(address):
        return ram[address - 0x4000] + 256 * ram[address + 1 - 0x4000]

    program = word(0x5C53)
    actual = bytes(ram[program - 0x4000:program - 0x4000 + len(expected)])
    # FN execution overwrites each formal's five reserved value bytes. Only these
    # two independently recognizable parameter slots may differ from the image.
    normalized = bytearray(actual)
    slots = []
    for prefix in (bytes.fromhex("ce66286e0e"), bytes.fromhex("ce67242873240e")):
        if expected.count(prefix) != 1:
            raise AssertionError("Unexpected independent formal slot layout")
        start = expected.index(prefix) + len(prefix)
        if expected[start:start + 5] != bytes(5):
            raise AssertionError("Expected zeroed formal reservation")
        slots.append({"offset": start, "runtimeBytes": actual[start:start + 5].hex()})
        normalized[start:start + 5] = bytes(5)
    if bytes(normalized) != expected or slots[0]["runtimeBytes"] != "0000060000":
        raise AssertionError("ROM-loaded code or numeric formal value differs")
    if word(0x5C1E) != 0:
        raise AssertionError("CLOSE #4 did not close the opened screen stream")
    font = {bytes(rom[0x3C00 + code * 8:0x3C00 + code * 8 + 8]): chr(code) for code in range(32, 127)}
    rows = []
    for row in range(24):
        text = "".join(font.get(bytes(ram[(row // 8) * 2048 + (row % 8) * 32 + col + pixel * 256] for pixel in range(8)), "?") for col in range(32)).rstrip()
        if text:
            rows.append({"row": row, "text": text})
    if "CORE OK" not in [row["text"] for row in rows] or "CORE FAIL" in [row["text"] for row in rows] or {"row": 23, "text": "0 OK, 100:1"} not in rows or ram[0x5C3A - 0x4000] != 255:
        raise AssertionError("Combined language execution failed: " + repr(rows))
    sna2img.main(["--scale", "2", str(snapshot_file), str(output / "core.png")])
    evidence = {"emulator": "SkoolKit 10.1, original 48K ROM", "romSha256": ROM_HASH, "tapSha256": hashlib.sha256(tape_bytes).hexdigest(), "programAddress": program, "completionPc": "0x12ac", "formalSlots": slots, "screenRows": rows, "fastLoad": False, "loaderAccelerators": False}
    (output / "evidence.json").write_text(json.dumps(evidence, indent=2) + "\n")
    print("Verified original ROM LOAD/RUN: arrays, READ/DATA, FOR/NEXT, RESTORE, numeric/string FN, slicing, OPEN/CLOSE -> CORE OK")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", type=Path, required=True)
    verify(parser.parse_args().output_dir.resolve())
