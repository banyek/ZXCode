# M7 product TAP import policy

Decision: product import promotes the M3 strict decoder/export experiment without
introducing a new source dialect. The independent core corpus and M3 acceptance
results already establish supported record framing, token boundaries, hidden
numbers, text escapes and variable separation; see 029 and 031. No new binary
interpretation is needed for this ticket.

The shared `importTapSource` operation accepts a single type-zero BASIC TAP
header/data pair and returns editable source only when the existing exporter
proves that recompiling it reproduces the complete BASIC program image exactly.
Malformed framing, extra cassette blocks, unsupported headers, raw/noncanonical
program records, hidden-number discrepancies and unrepresentable constructs
return a blocked result with explicit reasons, never a successful approximation.
The inspection API still exposes decoded bytes/candidate text for research; the
product import does not write those candidates as accepted source.

Default saved-variable policy is reject: source code cannot recreate the saved
runtime variables. The explicit `source-only` option permits importing only the
proven BASIC portion while reporting the omitted variable byte count. It does
not claim saved-state or whole-TAP preservation. Do not invent source declarations,
raw numeric override syntax or variable reconstruction. Keep the input untouched.
No lossy normalization mode is added; broader editable/semantic support belongs
to M7-06, and binary preservation belongs to M7-07.

CLI: `zxcode import input.tap [-o output.zxbas] [--source-only]`. Default output is
beside the input, with extension `.zxbas`. Always write a sibling
`output.zxbas.import.json` provenance report with schema version, input basename,
input TAP SHA-256, BASIC image SHA-256, emitted source SHA-256, original filename
bytes, autostart word, variables boundary and omitted-variable count. No timestamp
or absolute path is needed. This report records original metadata; ordinary build
does not silently consume it or restore autostart/name/variables.

Both output paths must be new. Exclusive creation prevents overwriting input,
existing files or symlink/hardlink aliases. Validate completely before writing;
if creating either output fails, remove only files created by this operation.
Existing outputs remain untouched. Unsupported input creates no output or report.
The source can be opened normally in VS Code; this ticket adds no second decoder
or editor-only import path.
