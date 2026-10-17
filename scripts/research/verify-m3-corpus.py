"""Recheck pinned corpus references without importing or running ZXCode."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import sys

parser = argparse.ArgumentParser()
parser.add_argument("--zmakebas", required=True, help="Pinned zmakebas 1.3.3 executable")
args = parser.parse_args()
root = Path(__file__).resolve().parents[2]
manifest = json.loads((root / "tests/fixtures/m3-corpus.json").read_text())
for entry in manifest["fixtures"]:
    path = root / "tests/fixtures" / entry["file"]
    if hashlib.sha256(path.read_bytes()).hexdigest() != entry["sha256"]:
        raise RuntimeError("Pinned reference changed: " + entry["file"])
    command = entry["reproduce"].replace("PYTHONPATH=<skoolkit-10.1> ", "").split()
    command[0] = sys.executable
    command = [args.zmakebas if part == "<zmakebas-1.3.3>" else part for part in command]
    subprocess.run(command, cwd=root, check=True)
print("Verified all nine independent M3 corpus reference sets; no fixtures changed")
