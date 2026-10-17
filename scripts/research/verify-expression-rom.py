"""Verify fixed expression traces with SkoolKit 10.1 and the original ROM.

No ZXCode imports or fixture rewrites. Inputs are independently stored tokenized
bytes, including compact integer markers; observes scanner reductions at 0x2753.
"""
import hashlib
import json
from importlib.metadata import version
from pathlib import Path

from skoolkit import ROM48
from skoolkit.simulator import Simulator

ROM_SHA256 = "d55daa439b673b0e3f5897f99ac37ecb45f974d1862b4dadb85dec34af99cb42"


def probe(source, entry=0x24FB):
    rom = Path(ROM48).read_bytes()
    if len(rom) != 16384 or hashlib.sha256(rom).hexdigest() != ROM_SHA256:
        raise RuntimeError("Unexpected ROM image")
    if not source or len(source) > 4096:
        raise ValueError("Research source exceeds its isolated memory region")
    memory = list(rom) + [0] * 49152

    def word(address, value):
        memory[address:address + 2] = [value & 255, value >> 8]

    memory[0x8000:0x8000 + len(source) + 1] = source + [13]
    word(0x5C5D, 0x8000)  # CH_ADD
    word(0x5C63, 0x9000)  # STKBOT
    word(0x5C65, 0x9000)  # STKEND
    word(0x5C68, 0x5C92)  # MEM calculator scratch area
    word(0xFF00, 0xFFFF)  # Sentinel return address
    memory[0x5C3B] = 192  # FLAGS: execution mode, numeric value
    simulator = Simulator(memory, {"A": source[0], "SP": 0xFF00, "PC": entry, "IY": 0x5C3A})
    operations = []
    for _ in range(2_000_000):
        pc = simulator.registers[24]
        if pc == 0x2753:  # Immediately after LD A,E: operation about to be reduced
            operations.append(simulator.registers[0] & 63)
        if pc == 0xFFFF:
            consumed = memory[0x5C5D] + 256 * memory[0x5C5E] - 0x8000
            stack_end = memory[0x5C65] + 256 * memory[0x5C66]
            if consumed != len(source) or stack_end != 0x9005:
                raise RuntimeError("Incomplete expression consumption or unexpected stack shape")
            return {"operations": operations, "storage": bytes(memory[0x9000:0x9005]).hex()}
        if pc == 8:
            raise RuntimeError("ROM expression error")
        simulator.run()
    raise RuntimeError("ROM instruction budget exceeded")


def main():
    if version("skoolkit") != "10.1":
        raise RuntimeError("Use SkoolKit 10.1")
    fixture_path = Path(__file__).resolve().parents[2] / "tests/fixtures/expression-rom.json"
    fixture = json.loads(fixture_path.read_text())
    if fixture["romSha256"] != ROM_SHA256:
        raise RuntimeError("Unexpected fixture ROM")
    cases = fixture["cases"] + fixture["binaryCases"]
    for case in cases:
        actual = probe(list(bytes.fromhex(case["encoded"])), case.get("entry", 0x24FB))
        expected = {key: case[key] for key in ("operations", "storage")}
        if actual != expected:
            raise AssertionError((case["source"], expected, actual))
    print("Verified", len(cases), "original-ROM expression cases; no fixtures changed")


if __name__ == "__main__":
    main()
