"""Verify fixed LOOK-VARS name boundaries using SkoolKit 10.1 and original ROM.

The routine checks syntax at 0x28B2. Partial consumption is deliberately retained:
for example, ab$ consumes only ab, leaving the illegal suffix for its caller.
This verifier never imports ZXCode or rewrites expected observations.
"""
import hashlib
import json
from importlib.metadata import version
from pathlib import Path

from skoolkit import ROM48
from skoolkit.simulator import Simulator

ROM_SHA256 = "d55daa439b673b0e3f5897f99ac37ecb45f974d1862b4dadb85dec34af99cb42"


def probe(name):
    rom = Path(ROM48).read_bytes()
    if len(rom) != 16384 or hashlib.sha256(rom).hexdigest() != ROM_SHA256:
        raise RuntimeError("Unexpected ROM image")
    source = list(name.encode("ascii")) + [13]
    if len(source) > 4096:
        raise ValueError("Research name exceeds its memory region")
    memory = list(rom) + [0] * 49152

    def word(address, value):
        memory[address:address + 2] = [value & 255, value >> 8]

    memory[0x8000:0x8000 + len(source)] = source
    word(0x5C5D, 0x8000)  # CH_ADD
    word(0xFF00, 0xFFFF)  # Sentinel return; FLAGS and DEFADD remain zero (syntax)
    simulator = Simulator(memory, {"PC": 0x28B2, "SP": 0xFF00, "IY": 0x5C3A})
    for _ in range(10_000):
        pc = simulator.registers[24]
        if pc == 0xFFFF:
            return {"consumed": memory[0x5C5D] + 256 * memory[0x5C5E] - 0x8000}
        if pc == 8:
            sp = simulator.registers[12]
            address = memory[sp] + 256 * memory[sp + 1]
            return {"romError": memory[address]}
        simulator.run()
    raise RuntimeError("LOOK-VARS instruction budget exceeded")


def main():
    if version("skoolkit") != "10.1":
        raise RuntimeError("Use SkoolKit 10.1")
    fixture_path = Path(__file__).resolve().parents[2] / "tests/fixtures/variable-rom.json"
    fixture = json.loads(fixture_path.read_text())
    if fixture["romSha256"] != ROM_SHA256:
        raise RuntimeError("Unexpected fixture ROM")
    for case in fixture["cases"]:
        expected = {key: case[key] for key in ("consumed", "romError") if key in case}
        actual = probe(case["source"])
        if expected != actual:
            raise AssertionError((case["source"], expected, actual))
    print("Verified", len(fixture["cases"]), "original-ROM variable boundaries; no fixtures changed")


if __name__ == "__main__":
    main()
