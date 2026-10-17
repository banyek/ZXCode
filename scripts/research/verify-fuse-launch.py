"""Optional Fuse 1.10.0 research; not a normal test dependency or ROM authority."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import tempfile
import time
import zlib

parser = argparse.ArgumentParser()
parser.add_argument("--fuse", required=True)
parser.add_argument("--tap", required=True)
parser.add_argument("--output", required=True)
parser.add_argument("--capture", action="store_true", help="Requires --with-null-ui --enable-automation build")
args = parser.parse_args()
tape = Path(args.tap).resolve()
output = Path(args.output).resolve()
output.mkdir(parents=True, exist_ok=True)
original = tape.read_bytes()
with tempfile.TemporaryDirectory(prefix="zxcode-fuse-config-") as configuration:
    root = Path(configuration)
    config = root / "fuse-emulator" / "fuserc"
    config.parent.mkdir()
    config.write_text("<settings/>\n")
    environment = dict(os.environ, XDG_CONFIG_HOME=str(root))
    version = subprocess.run([args.fuse, "--version"], env=environment, capture_output=True, text=True, check=True)
    assert "version 1.10.0" in version.stdout
    command = [args.fuse, "--machine", "48", "--auto-load", "--no-autosave-settings", "--no-confirm-actions", "--no-sound", "--tape", str(tape)]
    if args.capture:
        command += ["--automation-output", str(output), "--automation-frames", "500", "--automation-capture-screen"]
        completed = subprocess.run(command, env=environment, capture_output=True, text=True, timeout=30, check=True)
        (output / "emulator.log").write_text(completed.stdout + completed.stderr)
        result = json.loads((output / "result.json").read_text())
        assert result["execution"]["actual_machine"] == "48"
        assert result["execution"]["termination"]["type"] == "frames"
        assert result["identity"]["tape"]["crc32"] == "%08x" % zlib.crc32(original)
        assert result["settings"]["autoload"] is True
        assert result["artifacts"]["screen"]["status"] == "ok"
    else:
        with (output / "emulator.log").open("w") as log:
            process = subprocess.Popen(command, env=environment, stdout=log, stderr=log)
            try:
                time.sleep(1)
                assert process.poll() is None, "Desktop emulator exited before explicit stop"
                process.terminate()
                process.wait(timeout=5)
            finally:
                if process.poll() is None:
                    process.kill()
                    process.wait()
        result = {"dedicatedProcess": True, "stopped": True, "returncode": process.returncode}
    assert tape.read_bytes() == original
    assert config.read_text() == "<settings/>\n"
    evidence = {"emulator": version.stdout.strip(), "arguments": command[1:], "tapSha256": hashlib.sha256(original).hexdigest(), "configurationUnchanged": True, "result": result}
    (output / "launch-evidence.json").write_text(json.dumps(evidence, indent=2) + "\n")
print("Fuse launch/configuration evidence passed.")
