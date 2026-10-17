"""Compare fixed command/assignment images with the independently installed zmakebas 1.3.3.

The reference checkout used to capture these fixtures is recorded in their JSON.
This optional verifier never imports ZXCode or rewrites expected bytes.
"""
import argparse
import json
import subprocess
import tempfile
from pathlib import Path


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--zmakebas", type=Path, required=True)
    parser.add_argument("--fixture", type=Path)
    args = parser.parse_args()
    binary = args.zmakebas.resolve()
    version = subprocess.run([str(binary), "-h"], capture_output=True, text=True)
    if "zmakebas 1.3.3" not in version.stdout + version.stderr:
        raise RuntimeError("Use the pinned zmakebas 1.3.3 reference")
    path = args.fixture or Path(__file__).resolve().parents[2] / "tests/fixtures/simple-commands.json"
    fixture = json.loads(path.read_text())
    with tempfile.TemporaryDirectory(prefix="zxcode-reference-") as directory:
        source = Path(directory) / "commands.bas"
        output = Path(directory) / "commands.bin"
        for case in fixture["cases"]:
            source.write_text(case["source"])
            subprocess.run([str(binary), "-r", "-o", str(output), str(source)], check=True, capture_output=True)
            actual = output.read_bytes().hex()
            if actual != case["programHex"]:
                raise AssertionError((case["source"], case["programHex"], actual))
    print("Verified", len(fixture["cases"]), "independent command images; no fixtures changed")


if __name__ == "__main__":
    main()
