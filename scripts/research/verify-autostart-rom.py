"""Verify raw autostart word interpretation in the original ROM LOAD fragment."""
import hashlib
import json
from importlib.metadata import version
from pathlib import Path
from skoolkit import ROM48
from skoolkit.simulator import Simulator

ROM_HASH = "d55daa439b673b0e3f5897f99ac37ecb45f974d1862b4dadb85dec34af99cb42"


def probe(word):
    if version("skoolkit") != "10.1":
        raise RuntimeError("Use SkoolKit 10.1")
    rom = Path(ROM48).read_bytes()
    if hashlib.sha256(rom).hexdigest() != ROM_HASH:
        raise RuntimeError("Unexpected ROM")
    memory = list(rom) + [0] * 49152
    memory[0x800D:0x800F] = [word & 255, word >> 8]
    memory[0x5C42:0x5C45] = [255, 255, 0xAA]
    simulator = Simulator(memory, {"PC": 0x089B, "IX": 0x8000, "IY": 0x5C3A})
    for _ in range(30):
        if simulator.registers[24] == 0x08AD:
            new_line = memory[0x5C42] + 256 * memory[0x5C43]
            statement = memory[0x5C44]
            return {"enabled": statement == 0, "newPpc": new_line, "nextStatement": statement}
        simulator.run()
    raise RuntimeError("LOAD autostart fragment did not finish")


def main():
    fixture = json.loads((Path(__file__).resolve().parents[2] / "tests/fixtures/autostart-rom.json").read_text())
    if fixture["romSha256"] != ROM_HASH:
        raise RuntimeError("Unexpected fixture ROM")
    for case in fixture["cases"]:
        expected = {key: case[key] for key in ("enabled", "newPpc", "nextStatement")}
        if probe(case["word"]) != expected:
            raise AssertionError(case)
    print("Verified", len(fixture["cases"]), "original-ROM autostart boundaries, including bit 14 and bit 15; no fixtures changed")


if __name__ == "__main__":
    main()
