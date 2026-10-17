# M4 headless language-service acceptance

All query implementations are now exposed through one frozen `languageService`
object satisfying the original `LanguageServiceQueries` contract. Sessions remain
explicit versioned analysis owners; the facade adds no parser, transport, editor
state or placeholder query. Named query exports remain available.

The final gate queries every UTF-16 offset, including EOF and surrogate/codepoint
boundaries, in the eight independent core corpus programs and nineteen reviewed
incomplete-source fixtures. Diagnostics, completion, hover, definitions, references
with/without declarations, signatures and outlines must remain headless, return
the queried snapshot identity, and map every result/edit/related/selection range
back to checked source spans. Nested outline containment is checked recursively.

A deterministic streaming digest covers query values with explicit byte-length
framing. Reports contain document names/source hashes/position counts/query hashes,
not timestamps or host paths. These service-behavior digests supplement reviewed
fixture expectations; they are not independent binary language authority. The M3
independent byte acceptance remains unchanged.

Each existing Linux/macOS/Windows job retains its headless report. A dependent CI
job compares all three reports as JSON and fails on any platform difference. No
checked-in automatically captured query baseline replaces the reviewed nineteen
cursor fixtures. Local checks run the same headless sweep; normal CI needs neither
VS Code nor an emulator. Completing this gate unblocks the M5 extension adapter.

## Validation and reproduction

`npm run check` passes all 244 Node 24 tests, including 14,544 queries across
2,415 UTF-16 positions in 27 documents. Every query result is frozen and tagged
with its exact snapshot; all source/edit/related/outline ranges validate. The
platform comparator is tested with identical reports and an intentionally changed
query digest, which it rejects. `npm run test:service` emits the same report.

```sh
node scripts/compatibility/run-service.mjs --report artifacts/m4-language-service.json
node scripts/compatibility/compare-service-reports.mjs artifacts/m4-platforms
```

The second command expects the three downloaded platform artifact directories.
The dependent CI parity job supplies those reports and is part of the merge gate.
