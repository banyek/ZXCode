"""Execute original/imported tapes in fresh original-ROM machines; no fixture updates."""
import argparse
import hashlib
import json
import subprocess
import sys
from importlib.metadata import version
from pathlib import Path
from skoolkit import ROM48
from skoolkit.snapshot import Snapshot

ROOT = Path(__file__).resolve().parents[2]
ROM_HASH = "d55daa439b673b0e3f5897f99ac37ecb45f974d1862b4dadb85dec34af99cb42"


def main(output):
    if version("skoolkit") != "10.1":
        raise RuntimeError("Use SkoolKit 10.1")
    rom = Path(ROM48).read_bytes()
    if hashlib.sha256(rom).hexdigest() != ROM_HASH:
        raise RuntimeError("Unexpected ROM")
    output.mkdir(parents=True, exist_ok=False)
    cli = ROOT / "packages/cli/bin/zxcode.mjs"
    results = []
    for name, source, marker, completion in [
        ("arrays-functions", "examples/core/arrays-functions.bas", "CORE OK", "0 OK, 100:1"),
        ("escapes", "examples/escapes.bas", "ESCAPES OK", "0 OK, 40:1"),
    ]:
        original, rebuilt = output / f"{name}-original.tap", output / f"{name}-rebuilt.tap"
        imported = output / f"{name}.zxbas"
        for args in [["build", str(ROOT / source), "--output", str(original), "--name", "ORIGINAL"],
                     ["import", str(original), "--output", str(imported)],
                     ["build", str(imported), "--output", str(rebuilt), "--name", "IMPORTED"]]:
            subprocess.run(["node", str(cli), *args], check=True, capture_output=True, text=True, timeout=30)
        states = []
        for label, tape in [("original", original), ("rebuilt", rebuilt)]:
            snapshot_file = output / f"{name}-{label}.z80"
            command = [sys.executable, "-c", "import sys; from skoolkit import tap2sna; tap2sna.main(sys.argv[1:])",
                       "-c", 'load=LOAD "" : CLS : RUN', "-c", "machine=48", "-c", "fast-load=0",
                       "-c", "accelerator=none", "-c", "accelerate-dec-a=0", "-c", "finish-tape=1",
                       "-c", "timeout=60", "-s", "0x12ac", str(tape), str(snapshot_file)]
            process = subprocess.run(command, capture_output=True, text=True, timeout=90)
            (output / f"{name}-{label}.log").write_text(process.stdout + process.stderr)
            if process.returncode or "timed out" in process.stdout or "PC=4780" not in process.stdout:
                raise AssertionError(f"ROM execution failed: {name}/{label}")
            snapshot = Snapshot.get(str(snapshot_file))
            ram = bytes(snapshot.ram())
            if snapshot.pc != 0x12AC or len(ram) != 49152 or ram[0x5C3A-0x4000] != 255:
                raise AssertionError("Unexpected ROM completion")
            def word(address):
                offset = address-0x4000
                return ram[offset] + 256*ram[offset+1]
            prog, variables, end = word(0x5C53), word(0x5C4B), word(0x5C59)
            font = {bytes(rom[0x3C00+code*8:0x3C00+code*8+8]): chr(code) for code in range(32,128)}
            rows = []
            for row in range(24):
                text = "".join(font.get(bytes(ram[(row//8)*2048+(row%8)*32+col+pixel*256] for pixel in range(8)), "?") for col in range(32)).rstrip()
                if text:
                    rows.append(text)
            if marker not in rows or completion not in rows:
                raise AssertionError((name, label, rows))
            states.append({"screen":ram[:6912],"program":ram[prog-0x4000:variables-0x4000],"variables":ram[variables-0x4000:end-0x4000],"rows":rows})
        for region in ["screen", "program", "variables"]:
            if states[0][region] != states[1][region]:
                raise AssertionError(f"Runtime {region} differs: {name}")
        results.append({"name":name,"screenRows":states[0]["rows"],"runtimeSha256":{region:hashlib.sha256(states[0][region]).hexdigest() for region in ["screen","program","variables"]},"originalTapSha256":hashlib.sha256(original.read_bytes()).hexdigest(),"rebuiltTapSha256":hashlib.sha256(rebuilt.read_bytes()).hexdigest()})
    (output / "report.json").write_text(json.dumps({"schemaVersion":1,"romSha256":ROM_HASH,"emulator":"SkoolKit 10.1","fastLoad":False,"loaderAccelerators":False,"cases":results}, indent=2)+"\n")
    print("Verified original-ROM round trips: identical screens, post-run programs and variable regions")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", type=Path, required=True)
    main(parser.parse_args().output_dir.resolve())
