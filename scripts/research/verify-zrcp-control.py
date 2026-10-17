"""Probe an explicitly loopback-bound ZEsarUX 13.0 research build; no product adapter."""
import argparse
import hashlib
import json
import re
import socket
import subprocess
import time
from pathlib import Path

ROM_HASH = "d55daa439b673b0e3f5897f99ac37ecb45f974d1862b4dadb85dec34af99cb42"
PROMPT = re.compile(rb"\nzxcode-probe(?:@cpu-step)?> $")


def main(executable, output):
    output.mkdir(parents=True,exist_ok=False)
    with socket.socket() as reserved:
        reserved.bind(("127.0.0.1",0))
        port = reserved.getsockname()[1]
    arguments = [str(executable),"--noconfigfile","--machine","48k","--vo","null","--ao","null","--nowelcomemessage","--nosplash","--stats-send-already-asked","--stats-disable-check-updates","--stats-disable-check-yesterday-users","--enable-remoteprotocol","--remoteprotocol-port",str(port),"--remoteprotocol-prompt","zxcode-probe","--exit-after","30"]
    transcript = []
    with (output / "emulator.log").open("w") as log:
        process = subprocess.Popen(arguments,cwd=executable.parent,stdout=log,stderr=subprocess.STDOUT)
        connection = None
        try:
            def connect():
                deadline = time.monotonic()+5
                while time.monotonic()<deadline:
                    try:
                        result = socket.create_connection(("127.0.0.1",port),timeout=.2)
                        result.settimeout(5)
                        return result
                    except OSError:
                        if process.poll() is not None:
                            raise RuntimeError("Owned emulator exited before protocol connection")
                        time.sleep(.05)
                raise TimeoutError("Loopback listener did not become available")
            def read():
                data = b""
                while not PROMPT.search(data):
                    block = connection.recv(65536)
                    if not block:
                        raise RuntimeError("Protocol disconnected before prompt")
                    data += block
                    if len(data)>1048576:
                        raise RuntimeError("Protocol response exceeds research limit")
                return data.decode("ascii")
            def command(text, redact=False):
                connection.sendall((text+"\n").encode("ascii"))
                response = read()
                if "Error." in response:
                    raise AssertionError((text,response))
                transcript.append({"command":text,"response": "[ROM payload omitted]" if redact else response})
                return response.split("\nzxcode-probe")[0]
            def pc():
                response = command("get-registers")
                match = re.search(r"\bPC=([0-9a-fA-F]{4})\b",response)
                if match is None:
                    raise AssertionError("Unrecognized register response")
                return int(match[1],16)
            connection = connect()
            transcript.append({"greeting":read()})
            if command("get-version").strip() != "13.0":
                raise AssertionError("Use the pinned 13.0 release")
            command("enter-cpu-step")
            rom = bytes.fromhex(command("read-memory 0 16384",redact=True).strip())
            if hashlib.sha256(rom).hexdigest() != ROM_HASH:
                raise AssertionError("Active mapped ROM differs from pinned original 48K ROM")
            command("write-memory 32768 0 0 60 195 0 128")
            if command("read-memory 32768 6").strip().upper() != "00003CC30080":
                raise AssertionError("Memory write/read did not round trip")
            command("set-register PC=32768")
            command("set-register IFF1=0")
            command("enable-breakpoints")
            command("set-breakpoint 1 PC=32769")
            command("enable-breakpoint 1")
            command("run 100")
            if pc() != 0x8001:
                raise AssertionError("Conditional machine breakpoint did not stop at 0x8001")
            command("cpu-step")
            if pc() != 0x8002:
                raise AssertionError("Single NOP step did not advance PC")
            command("disable-breakpoints")
            # Bounded ZRCP-owned execution and native free-running mode are distinct.
            command("run 20")
            before_resume = command("get-registers")
            command("exit-cpu-step")
            time.sleep(.05)
            command("enter-cpu-step")
            after_pause = command("get-registers")
            if before_resume == after_pause:
                raise AssertionError("Resume/pause did not observe CPU progress")
            # Close one client while paused; reattach and retain machine ownership.
            connection.sendall(b"quit\n")
            connection.close()
            connection = connect()
            read()
            command("enter-cpu-step")
            if not 0x8000 <= pc() <= 0x8006:
                raise AssertionError("Reconnect lost the controlled scratch program")
            command("reset-cpu")
            if pc() != 0:
                raise AssertionError("Reset did not return to ROM entry")
            connection.sendall(b"exit-emulator\n")
            connection.close()
            connection = None
            process.wait(timeout=5)
            if process.returncode != 0:
                raise AssertionError("Owned emulator did not exit cleanly")
            report = {"schemaVersion":1,"status":"passed","emulator":"ZEsarUX 13.0","upstreamCommit":"0bb4277d714128311d78bc0625fb12ae8308899a","researchModification":"ZRCP listener bind NULL -> 127.0.0.1; no CPU/ROM changes","platform":"macOS arm64 local build","activeRomSha256":ROM_HASH,"verified":["pause","resume","register-read-write","memory-read-write","conditional-machine-breakpoint","single-instruction-step","bounded-run","client-reconnect","reset","owned-clean-exit"],"exitCode":process.returncode,"transcript":transcript}
            (output / "report.json").write_text(json.dumps(report,indent=2)+"\n")
            print("Verified loopback ZRCP: pause/resume, registers/memory, conditional breakpoint, step, reconnect, reset and clean exit")
        finally:
            if connection is not None:
                connection.close()
            if process.poll() is None:
                process.terminate()
                try:
                    process.wait(timeout=3)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait(timeout=3)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--executable",type=Path,required=True,help="Explicitly loopback-bound 13.0 research build; do not pass an all-interface listener build")
    parser.add_argument("--output-dir",type=Path,required=True)
    args = parser.parse_args()
    main(args.executable.resolve(),args.output_dir.resolve())
