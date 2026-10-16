"""Independent, bounded clean-boot memory probe; requires SkoolKit 10.1."""
import hashlib
import json
from importlib.metadata import version
from pathlib import Path

from skoolkit import ROM48
from skoolkit.simulator import Simulator

root = Path(__file__).resolve().parents[2]
fixture = json.loads((root / "tests/fixtures/numeric-rom.json").read_text())
rom = Path(ROM48).read_bytes()
if version("skoolkit") != "10.1" or hashlib.sha256(rom).hexdigest() != fixture["romSha256"]:
    raise RuntimeError("Unexpected simulator or ROM")
memory = list(rom) + [0] * 49152
simulator = Simulator(memory, {"PC": 0}, config={"fast_ldir": True, "fast_djnz": True})
for _ in range(2_000_000):
    simulator.run()


def word(address):
    return memory[address] + 256 * memory[address + 1]


result = {"PROG": word(0x5C53), "RAMTOP": word(0x5CB2), "marginAfter32KiB": word(0x5CB2) - word(0x5C53) - 32768}
if result != {"PROG": 23755, "RAMTOP": 65367, "marginAfter32KiB": 8844}:
    raise AssertionError(result)
print(json.dumps(result))
