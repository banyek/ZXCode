# M3 deterministic fidelity acceptance

Acceptance fixes the supported development matrix at Node.js 24 on Linux, macOS
and Windows. Each CI job runs the same full check and independently compares the
compatibility report with a checked-in baseline, then retains the JSON report as
an artifact named by platform. No timestamp, host path or platform-specific field
enters the report. The report contract is compared as JSON data; artifact bytes
are written by Node with explicit LF rather than shell-dependent redirection.

The baseline is derived solely from the pinned independent fixtures: each image
is framed by a four-byte little-endian length before hashing, so the stream is
unambiguous. A separate Python verifier recomputes every digest, case/rejection
count and declared source-export limit without importing or executing ZXCode.
Compiler output must separately pass exact image comparisons in the corpus
runner; agreement with a report alone cannot establish fidelity.

The completed M3 guarantees are stored numeric fidelity, complete byte identity
and checked text packets, explicit source escapes, strict TAP framing/metadata,
and raw-preserving BASIC decoding with a checked exact-source export subset.
No placeholder path remains in the supported encoder/decoder/container dispatch.
Unknown/malformed input is retained with issues or rejected explicitly. Eight
incomplete raw text packets remain unsupported exports as specified in design
029/030; arbitrary runtime variables and mutable numeric slots are not normalized
into source. M7 owns user import policy, not an extension of M3's exact guarantee.

The final gate requires all matrix jobs to pass, the independent research verifier
to pass, and the original-ROM escaped-text LOAD/RUN smoke check to pass. External
ROM/emulator tools remain optional research tools, not normal CI dependencies.

Pinned fixture files use an explicit Git LF checkout policy, including on Windows;
reference hashes measure the file contents, so implicit CRLF checkout conversion
would otherwise change their identity before the runner starts.

## Reproduction and local evidence

```sh
npm ci
npm run check
node scripts/compatibility/acceptance.mjs --report artifacts/m3-compatibility.json
python3 scripts/research/verify-m3-report.py
PYTHONPATH=<skoolkit-10.1> python3 scripts/research/verify-m3-corpus.py --zmakebas <zmakebas-1.3.3>
PYTHONPATH=<skoolkit-10.1> python3 scripts/research/smoke-escapes.py --output-dir <proof-directory>
```

Run the JavaScript/CLI commands under Node 24, including the CLI invoked by the
smoke procedure. Local Node 24 validation passes all 209 tests. The independent
report derivation and all nine external reference verifiers pass without changing
fixtures. The repeated original-ROM LOAD/RUN proof verifies exact loaded bytes,
raw CR/STOP in REM, UDG/block/quote CODE values, red ESCAPES OK, and 0 OK, 40:1.
Screen, snapshot, cassette and machine-readable evidence are retained in the
selected proof directory. The three-platform CI matrix is the merge gate and
retains one compatibility report per platform for each accepted revision.
