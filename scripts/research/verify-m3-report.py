"""Derive the acceptance report from independent fixture bytes, without ZXCode."""
import hashlib
import json
from pathlib import Path
import struct
import sys

root = Path(__file__).resolve().parents[2]
fixtures = root / "tests/fixtures"
manifest = json.loads((fixtures / "m3-corpus.json").read_text())
reports = []
for entry in manifest["fixtures"]:
    raw = (fixtures / entry["file"]).read_bytes()
    digest = hashlib.sha256(raw).hexdigest()
    if digest != entry["sha256"]:
        raise RuntimeError("Reference changed: " + entry["file"])
    data = json.loads(raw)
    images = []
    rejected = exact = unsupported = 0
    for case in data["cases"]:
        family = entry["family"]
        image = None
        if family == "numeric":
            if "programHex" not in case:
                rejected += 1
                continue
            image = bytes.fromhex(case["programHex"])
            exact += 1
        elif family == "body":
            if "statements" not in case:
                rejected += 1
                continue
            body = bytes.fromhex(case["encoded"])
            image = b"\x00\x0a" + struct.pack("<H", len(body) + 1) + body + b"\x0d"
            if case["source"] in entry.get("unsupportedExportSources", []):
                unsupported += 1
            else:
                exact += 1
        elif family == "graphics":
            image = b"\x00\x0a\x05\x00\xf5\x22" + bytes([case["byte"]]) + b"\x22\x0d"
            exact += 1
        elif family == "core":
            image = bytes.fromhex(case["programHex"])
            exact += 1
        elif family == "controls":
            image = bytes.fromhex(case["bytesHex"])
        elif family == "tap":
            image = bytes.fromhex(case["tapHex"])
        elif family == "autostart":
            image = struct.pack("<HB", case["word"], int(case["enabled"]))
        else:
            raise RuntimeError("Unknown corpus family")
        images.append(struct.pack("<I", len(image)) + image)
    reports.append(dict(file=entry["file"], referenceSha256=digest, cases=len(data["cases"]), rejected=rejected, exactExports=exact, unsupportedExports=unsupported, imageSha256=hashlib.sha256(b"".join(images)).hexdigest()))
report = dict(version=manifest["version"], fixtures=reports)
if sys.argv[1:] == ["--print"]:
    print(json.dumps(report, indent=2))
elif sys.argv[1:]:
    raise RuntimeError("Usage: verify-m3-report.py [--print]")
else:
    expected = json.loads((fixtures / "m3-acceptance.json").read_text())
    if report != expected:
        raise RuntimeError("Acceptance report differs from independent fixture derivation")
    print("Verified M3 report counts and image digests independently; no fixtures changed")
