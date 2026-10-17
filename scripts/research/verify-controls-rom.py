"""Check control dispatch/arity directly against pinned original ROM bytes."""
import hashlib
import json
from pathlib import Path
from skoolkit import ROM48

ROM_HASH = "d55daa439b673b0e3f5897f99ac37ecb45f974d1862b4dadb85dec34af99cb42"
rom = Path(ROM48).read_bytes()
if hashlib.sha256(rom).hexdigest() != ROM_HASH:
    raise RuntimeError("Unexpected ROM")
fixture = json.loads((Path(__file__).resolve().parents[2] / "tests/fixtures/controls-rom.json").read_text())
if fixture["romSha256"] != ROM_HASH:
    raise RuntimeError("Unexpected fixture ROM")
for control in fixture["controls"]:
    address = 0x0A0B + control["byte"]
    target = address + rom[address]
    if target != control["romDispatch"]:
        raise AssertionError(control)
    if control["arity"] and target != (0x0A7A if control["arity"] == 1 else 0x0A75):
        raise AssertionError("Unexpected parameter handler")
print("Verified", len(fixture["controls"]), "original-ROM control dispatches and parameter arities; no fixtures changed")
