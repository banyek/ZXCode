# M1 — Hello Spectrum acceptance

The reference for this milestone is **SkoolKit 10.1's headless 48K emulation**,
using its unmodified original 48K ROM. It simulates keyboard entry, cassette
pulses, ROM loading, BASIC execution, and display RAM. This is a test target,
not a production runtime dependency or a selection for M6/M8 integration.

## Independent golden provenance

The BASIC image golden was established in M1-08. The complete TAP expectations
`tests/fixtures/hello.tap.hex` and `hello-autostart.tap.hex` are produced by
zmakebas 1.3.3, revision `667090faf392e0083bbcf238084dcdd996957285`, independently
of ZXCode:

```sh
zmakebas -n hello -o hello-reference.tap examples/hello.bas
zmakebas -n hello -a 10 -o hello-autostart-reference.tap examples/hello.bas
```

Both contain the same 19-byte BASIC image. The 44-byte TAP files differ only in
autostart metadata and its parity. Unit tests compare complete generated TAP
bytes and source fixture identity; expected bytes never come from ZXCode.

## Reproduce the ROM load/run proof

Use Node.js 24 and a separate Python environment:

```sh
npm ci
npm run check
python3 -m venv /tmp/zxcode-m1-venv
/tmp/zxcode-m1-venv/bin/python -m pip install skoolkit==10.1
/tmp/zxcode-m1-venv/bin/python scripts/research/smoke-hello.py --output-dir /tmp/zxcode-m1-proof
```

The harness builds `examples/hello.bas` through the real CLI and compares its TAP
with the independent golden. SkoolKit then enters `LOAD "": RUN` via simulated
keyboard input on the original ROM. The selected load configuration is documented
by [SkoolKit's command reference](https://skoolkit.ca/docs/skoolkit/commands.html#tap2sna-py):
48K machine, `fast-load=0`, `accelerator=none`, `accelerate-dec-a=0`,
`finish-tape=1`, and a 60-second simulated-time limit.

It stops at the [ROM editing loop, 12ACh](https://skoolkid.github.io/rom/asm/12A2.html)
after tape completion. This is a completion condition, not a BASIC-line/Z80-PC
mapping. A separate wall-clock timeout bounds the subprocess as well.

The verifier checks all of the following, rather than relying on a process exit:

- The pinned original ROM SHA-256 matches the numeric-research provenance.
- The reference simulator reaches the expected completion point without timeout.
- Snapshot RAM is 48K; the program at the ROM's live PROG pointer matches the
  independent BASIC image exactly.
- Actual screen bitmap cells match the original ROM font for `HELLO WORLD`.
- ROM ERR_NR is FFh, and the screen report is `0 OK, 10:1`.

The retained output directory contains the built TAP, resulting Z80 snapshot,
reference-emulator log, JSON evidence, and a PNG rendered from the screen RAM by
SkoolKit. No expected file is rewritten. Omitting `--output-dir` uses a temporary
directory that is deleted after verification. Normal CI compares fixed BASIC/TAP
goldens and does not install Python, SkoolKit, or a ROM.

## Observed result

On 2026-10-16, the default non-autostart TAP loaded through original ROM cassette
routines and `RUN` displayed `HELLO WORLD` on row 0. It returned to 12ACh with
ERR_NR=FFh and report `0 OK, 10:1`. The autostart-10 TAP also loaded and executed
successfully during reference selection. This proves the M1 vertical slice;
broader BASIC grammar and fidelity remain subsequent milestone work.
