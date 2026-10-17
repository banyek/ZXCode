# M3-08 BASIC import feasibility

The spike reads stored BASIC, not a screen LIST transcript. The existing TAP
reader establishes the type-zero container and variables boundary. BASIC line
records use a big-endian line number, little-endian body length including final
0Dh, then stored body bytes. Existing independently produced core fixtures and
original-ROM probes establish these fields, hidden 0Eh/five-byte numeric storage,
REM tails, doubled string quotes and DEF FN parameter slots.

Decoding retains owned record/body bytes and offset-bearing segments. It checks
record boundaries and final terminators without searching for a replacement
boundary. Quotes protect tokens; REM protects the entire remaining body. Outside
these contexts 0Eh owns the following five bytes, including mutable FN slots.
Unknown bytes, truncated packets and malformed records are reported explicitly.
Numeric storage is retained, never reconstructed from the visible spelling.

Source export is a separate orchestration experiment: canonical token spellings,
existing text escape formatting and visible numeric spelling produce a candidate.
The shared compiler must accept that candidate and reproduce the entire original
BASIC image byte for byte before the API reports an exact source round trip.
Thus hidden-number disagreements, runtime-mutated FN slots, unsupported names,
noncanonical stored spaces, malformed packets or out-of-policy line numbers may
have a decodable byte model but no exact source export. No bytes are silently
claimed preserved by a successful source import when they differ.

Saved variables are retained separately using the TAP header offset; they are
not source declarations and are not re-created by compiling exported BASIC.
The spike has no CLI import command and does not promise runtime memory/snapshot,
multiple cassette files, array headers or arbitrary hand-patched BASIC support.
M7 must decide editable normalization policy, diagnostics UI, variables handling,
raw numeric overrides and presentation of non-exportable records. This spike
introduces no source grammar or byte override outside string/REM contexts.

## Implemented experiment and evidence

`decodeBasicProgram` exposes owned whole-image/record/segment bytes, byte offsets,
raw segments and structured framing issues. `exportBasicSource` reports `exact`
only after `checkProgram` reproduces those bytes; otherwise it returns an
`unsupported` candidate with reasons and the unchanged decoded model.
`inspectBasicTap` composes the strict cassette reader with this experiment,
retaining opaque saved variables separately. No new language grammar is enabled.
The body power byte 5Eh exports as the existing `^` operator, while string/REM
5Eh uses the Spectrum up-arrow glyph; text and operator contexts stay distinct.

All eight independently referenced core corpus images export exactly, including
all fifty command tokens, functions, numeric rounding, arrays, FN formal slots,
PRINT/INPUT streams, graphics and raw REM tails. Exhaustive context probes retain
all 256 byte values in REM and all 255 representable values in quoted strings.
Malformed records, truncated numeric/control packets, raw bytes outside text,
noncanonical spacing, out-of-policy line numbers, modified hidden numbers and
runtime-mutated FN slots retain their bytes and cannot report an exact export.
Buffer ownership and saved-variable separation have dedicated checks. Original
reference images remain unchanged; this adds supplemental round-trip tests.
