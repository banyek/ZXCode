# Source and diagnostics

Source identity, offsets, ranges, locations, and structured diagnostics live here.
This is the bottom layer: it must not import syntax, semantics, encoding, TAP,
CLI, or editor code.

`SourceDocument` holds immutable text already decoded from UTF-8 by the host.
Callers supply a nonempty identity unique to that snapshot; a later edit must
receive a new identity. Text is never normalized or transliterated here.

Offsets and columns count UTF-16 code units, not UTF-8 bytes or Unicode glyphs.
Lines and columns are zero-based. LF, CRLF, and CR start a new line; an empty
document has one line, and a trailing terminator creates a final empty line.
Every offset through EOF round-trips through `positionAt`/`offsetAt`. Columns
include terminator code units before the next line start, including the interior
of CRLF; an editor protocol adapter must apply its own newline-position policy.

`SourceRange` validates integer bounds against the document and enforces a
half-open `[start, end)` interval. Empty ranges permit insertion diagnostics.
Ranges retain snapshot identity, and slicing rejects another snapshot's range.
Invalid coordinates throw instead of clamping. Source text representability as
Spectrum bytes is a later compatibility concern, not a coordinate restriction.

Diagnostics are immutable serializable core data with a stable `ZXdddd` code,
severity, category, message, checked primary range, and optional related ranges
and capability. Codes in `DiagnosticCodes` reserve kinds for the parser and
analyzer; defining a code does not implement the corresponding check. New codes
may be added, but existing codes must not be repurposed. No diagnostic here
decides whether a program is buildable; M1-06 owns that policy.
