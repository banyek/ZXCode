"""Check fixed Spectrum glyph evidence against original ROM, without ZXCode."""
import hashlib
import json
from importlib.metadata import version
from pathlib import Path
from skoolkit import ROM48
from skoolkit.simulator import Simulator

ROM_HASH = "d55daa439b673b0e3f5897f99ac37ecb45f974d1862b4dadb85dec34af99cb42"


def rom_bytes():
    if version("skoolkit") != "10.1":
        raise RuntimeError("Use SkoolKit 10.1")
    rom = Path(ROM48).read_bytes()
    if hashlib.sha256(rom).hexdigest() != ROM_HASH:
        raise RuntimeError("Unexpected ROM")
    return rom


def block_bitmap(byte):
    memory = list(rom_bytes()) + [0] * 49152
    memory[0xFF00:0xFF02] = [255, 255]
    simulator = Simulator(memory, {"PC": 0x0B38, "SP": 0xFF00, "B": byte})
    for _ in range(200):
        if simulator.registers[24] == 0xFFFF:
            return bytes(memory[0x5C92:0x5C9A]).hex()
        simulator.run()
    raise RuntimeError("ROM graphics construction did not return")


def main():
    fixture = json.loads((Path(__file__).resolve().parents[2] / "tests/fixtures/characters-rom.json").read_text())
    rom = rom_bytes()
    if fixture["romSha256"] != ROM_HASH:
        raise RuntimeError("Unexpected fixture ROM")
    for glyph in fixture["fontEvidence"]:
        offset = 0x3C00 + glyph["byte"] * 8
        if rom[offset:offset + 8].hex() != glyph["bitmap"]:
            raise AssertionError(glyph)
    for block in fixture["blocks"]:
        if block_bitmap(block["byte"]) != block["bitmap"]:
            raise AssertionError(block)
    print("Verified", len(fixture["fontEvidence"]), "ROM font glyphs and", len(fixture["blocks"]), "ROM-generated graphics blocks; no fixtures changed")


if __name__ == "__main__":
    main()
