"""Recheck fixed TAP references with independent struct packing/XOR, not ZXCode."""
import functools
import hashlib
import json
import operator
import struct
from pathlib import Path


def block(flag, payload):
    content = bytes([flag]) + payload
    return struct.pack("<H", len(content) + 1) + content + bytes([functools.reduce(operator.xor, content, 0)])


def basic(payload, filename, autostart, variables):
    header = b"\0" + filename + struct.pack("<HHH", len(payload), autostart, variables)
    return block(0, header) + block(255, payload)


fixture = json.loads((Path(__file__).resolve().parents[2] / "tests/fixtures/tap-metadata.json").read_text())
for case in fixture["cases"]:
    actual = basic(bytes.fromhex(case["payloadHex"]), bytes.fromhex(case["filenameHex"]), case["autostart"], case["variablesOffset"])
    if actual.hex() != case["tapHex"]:
        raise AssertionError(case["name"])
for case in fixture["blocks"]:
    if block(case["flag"], bytes.fromhex(case["payloadHex"])).hex() != case["blockHex"]:
        raise AssertionError(case)
maximum = fixture["maximum"]
payload = bytes(index & 255 for index in range(maximum["payloadLength"]))
actual = basic(payload, bytes.fromhex(maximum["filenameHex"]), maximum["autostart"], maximum["variablesOffset"])
if len(actual) != maximum["tapLength"] or actual[:21].hex() != maximum["headerHex"] or hashlib.sha256(actual).hexdigest() != maximum["tapSha256"]:
    raise AssertionError("Maximum block fixture differs")
print("Verified", len(fixture["cases"]), "BASIC TAP images,", len(fixture["blocks"]), "opaque blocks and the maximum-size image; no fixtures changed")
