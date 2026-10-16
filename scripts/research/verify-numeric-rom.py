"""Verify numeric fixtures with SkoolKit 10.1 executing the unmodified 48K ROM.

Install SkoolKit in a separate environment. This script does not import ZXCode,
generate expectations from its implementation, or rewrite fixture files.
"""
import hashlib
import json
import sys
from importlib.metadata import version
from pathlib import Path

from skoolkit import ROM48
from skoolkit.simulator import Simulator

ROM_SHA256 = "d55daa439b673b0e3f5897f99ac37ecb45f974d1862b4dadb85dec34af99cb42"


def convert_with_rom(literal):
    rom = Path(ROM48).read_bytes()
    if len(rom) != 16384 or hashlib.sha256(rom).hexdigest() != ROM_SHA256:
        raise RuntimeError("Unexpected ROM image; refusing to produce evidence")
    memory = list(rom) + [0] * (65536 - len(rom))

    def word(address, value):
        memory[address:address + 2] = [value & 255, value >> 8]

    source = list(literal.encode("ascii")) + [13]
    if len(source) > 4096:
        raise ValueError("Research input exceeds the isolated source region")
    memory[0x8000:0x8000 + len(source)] = source
    word(0x5C5D, 0x8000)  # CH_ADD
    word(0x5C63, 0x9000)  # STKBOT
    word(0x5C65, 0x9000)  # STKEND
    word(0x5C68, 0x5C92)  # MEM, calculator scratch area
    word(0xFF00, 0xFFFF)  # sentinel return address
    simulator = Simulator(memory, {"A": source[0], "SP": 0xFF00, "PC": 0x2C9B})
    for _ in range(2_000_000):
        pc = simulator.registers[24]
        if pc == 0xFFFF:
            end = memory[0x5C65] + 256 * memory[0x5C66]
            consumed = memory[0x5C5D] + 256 * memory[0x5C5E] - 0x8000
            if end != 0x9005 or consumed != len(literal):
                raise RuntimeError("Unexpected stack shape or incomplete literal consumption")
            return {"storage": bytes(memory[end - 5:end]).hex()}
        if pc == 8:  # RST 8: the byte at the pushed return address is the error code.
            sp = simulator.registers[12]
            address = memory[sp] + 256 * memory[sp + 1]
            return {"romError": memory[address]}
        simulator.run()
    raise RuntimeError("ROM instruction limit exceeded: " + literal)


def main():
    if version("skoolkit") != "10.1":
        raise RuntimeError("Use the pinned independent simulator: SkoolKit 10.1")
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parents[2] / "tests/fixtures/numeric-rom.json"
    fixture = json.loads(path.read_text())
    if fixture["romSha256"] != ROM_SHA256:
        raise RuntimeError("Fixture records an unexpected ROM")
    for case in fixture["cases"]:
        expected = {key: case[key] for key in ("storage", "romError") if key in case}
        actual = convert_with_rom(case["literal"])
        if actual != expected:
            raise AssertionError((case["literal"], expected, actual))
    print("Verified", len(fixture["cases"]), "cases against the original ROM; no fixtures changed")


if __name__ == "__main__":
    main()
