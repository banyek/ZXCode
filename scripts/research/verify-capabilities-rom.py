"""Verify base-ROM peripheral dispatch and its runtime error, without ZXCode."""
import hashlib
from importlib.metadata import version
from pathlib import Path
from skoolkit import ROM48
from skoolkit.simulator import Simulator

if version("skoolkit") != "10.1":
    raise RuntimeError("Use SkoolKit 10.1")
rom = Path(ROM48).read_bytes()
if hashlib.sha256(rom).hexdigest() != "d55daa439b673b0e3f5897f99ac37ecb45f974d1862b4dadb85dec34af99cb42":
    raise RuntimeError("Unexpected ROM")
for address in (0x1B08, 0x1B0E, 0x1B12, 0x1B15):
    if int.from_bytes(rom[address:address + 2], "little") != 0x1793:
        raise AssertionError("Unexpected peripheral command dispatch")
if rom[0x1793:0x1795] != bytes.fromhex("1890") or rom[0x1725:0x1727] != bytes.fromhex("cf17"):
    raise AssertionError("Unexpected extension stub/error path")
memory = list(rom) + [0] * 49152
simulator = Simulator(memory, {"PC": 0x1793, "SP": 0xFF00})
for _ in range(20):
    if simulator.registers[24] == 8:
        sp = simulator.registers[12]
        pointer = memory[sp] + 256 * memory[sp + 1]
        if memory[pointer] != 0x17:
            raise AssertionError("Unexpected runtime report")
        break
    simulator.run()
else:
    raise RuntimeError("Stub did not report its runtime error")
print("Verified four original-ROM extension dispatches and runtime report O (Invalid stream)")
