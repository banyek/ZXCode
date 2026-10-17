"""Verify expression types/errors with the original 48K ROM syntax checker.

Fixed encoded inputs contain variable references instead of decimal literals, so
SCANNING (0x24FB) does not insert numeric storage. No ZXCode imports or rewrites.
"""
import hashlib
import json
from importlib.metadata import version
from pathlib import Path

from skoolkit import ROM48
from skoolkit.simulator import Simulator

ROM_SHA256 = "d55daa439b673b0e3f5897f99ac37ecb45f974d1862b4dadb85dec34af99cb42"


def probe(encoded):
    rom = Path(ROM48).read_bytes()
    if len(rom) != 16384 or hashlib.sha256(rom).hexdigest() != ROM_SHA256:
        raise RuntimeError("Unexpected ROM image")
    source = list(bytes.fromhex(encoded)) + [13]
    if len(source) > 4096:
        raise ValueError("Expression exceeds its memory region")
    memory = list(rom) + [0] * 49152

    def word(address, value):
        memory[address:address + 2] = [value & 255, value >> 8]

    memory[0x8000:0x8000 + len(source)] = source
    word(0x5C5D, 0x8000)
    word(0x5C63, 0x9000)
    word(0x5C65, 0x9000)
    word(0x5C68, 0x5C92)
    word(0xFF00, 0xFFFF)
    simulator = Simulator(memory, {"PC": 0x24FB, "SP": 0xFF00, "IY": 0x5C3A})
    for _ in range(100_000):
        pc = simulator.registers[24]
        if pc == 0xFFFF:
            consumed = memory[0x5C5D] + 256 * memory[0x5C5E] - 0x8000
            if consumed != len(source) - 1:
                raise RuntimeError("Incomplete syntax consumption")
            return {"type": "numeric" if memory[0x5C3B] & 64 else "string"}
        if pc == 8:
            sp = simulator.registers[12]
            address = memory[sp] + 256 * memory[sp + 1]
            return {"romError": memory[address]}
        simulator.run()
    raise RuntimeError("Syntax checker instruction budget exceeded")


def main():
    if version("skoolkit") != "10.1":
        raise RuntimeError("Use SkoolKit 10.1")
    path = Path(__file__).resolve().parents[2] / "tests/fixtures/expression-types-rom.json"
    fixture = json.loads(path.read_text())
    if fixture["romSha256"] != ROM_SHA256:
        raise RuntimeError("Unexpected fixture ROM")
    for case in fixture["cases"]:
        expected = {key: case[key] for key in ("type", "romError") if key in case}
        actual = probe(case["encoded"])
        if actual != expected:
            raise AssertionError((case["source"], expected, actual))
    print("Verified", len(fixture["cases"]), "original-ROM expression types; no fixtures changed")


if __name__ == "__main__":
    main()
