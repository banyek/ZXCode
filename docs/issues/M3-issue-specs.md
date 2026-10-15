# M3 — Spectrum Fidelity: Issue Specifications

## M3-01 — Harden numeric representation across full lexical surface
**Readiness:** research-required
**Dependencies:** M2

Extend M1 numeric work across integer, decimal, exponent, sign and edge forms accepted by Spectrum BASIC. Cross-check stored textual and binary numeric representations.

**Acceptance criteria:** independent byte fixtures cover representative lexical classes and boundaries; parse/encode behaviour is documented; host numeric quirks cannot change deterministic output.

## M3-02 — Build complete Spectrum character map
**Readiness:** research-required
**Dependencies:** M2

Define byte/category/display/export identities for printable characters, Spectrum-specific glyphs, controls, graphics, UDG and token ranges.

**Acceptance criteria:** every relevant byte classified; mapping source/provenance documented; encoder/decoder share one table.

## M3-03 — Implement and fixture control-code encoding
**Readiness:** research-required
**Dependencies:** M3-02

**Acceptance criteria:** control families and parameter bytes fixture-tested; strings containing controls round-trip through internal representation; invalid parameter/source forms diagnose.

## M3-04 — Design UDG and block-graphics source representation
**Readiness:** design-required
**Dependencies:** M3-02

**Acceptance criteria:** notation is portable UTF-8 text, unambiguous, human-readable where practical and exact-byte capable; no dependence on lookalike Unicode glyphs; round-trip examples documented.

## M3-05 — Freeze textual escape syntax
**Readiness:** design-required
**Dependencies:** M3-03, M3-04

Choose named/raw escape forms including literal-brace escaping and contexts where escapes are active.

**Acceptance criteria:** syntax handles controls, arbitrary required bytes, UDG/graphics and literal delimiters; lexer rules specified; compatibility contract updated; syntax is backed by fixtures before freeze.

## M3-06 — Harden strings, REM and keyword lexical edge cases
**Readiness:** research-required
**Dependencies:** M3-05

**Acceptance criteria:** keyword-looking text, quotes, colons, escapes and raw REM content tested against references; no global textual token replacement; exact encoding verified.

## M3-07 — Harden TAP metadata, autostart and container edge cases
**Readiness:** research-required
**Dependencies:** M2

**Acceptance criteria:** header fields/checksums/lengths/autostart policy fixture-tested; invalid container inputs rejected; deterministic output across platforms.

## M3-08 — Implement TAP decoder/import feasibility spike
**Readiness:** research-required
**Dependencies:** M3-02, M3-03

Decode supported BASIC TAP/program bytes sufficiently to test source-format round-trip assumptions.

**Non-goal:** polished user import.

**Acceptance criteria:** spike decodes representative fixture corpus; unknown/raw bytes are surfaced rather than lost; limitations documented for M7.

## M3-09 — Build independent compatibility corpus
**Readiness:** research-required
**Dependencies:** M3-01..M3-08

**Acceptance criteria:** corpus includes awkward numeric, charset, controls, REM, strings, graphics/UDG and TAP cases; expected bytes derive from independent references/tools/manual verification; provenance recorded.

## M3-10 — M3 deterministic fidelity acceptance
**Readiness:** blocked
**Dependencies:** M3-09

**Acceptance criteria:** supported corpus produces exact expected BASIC/TAP bytes on supported development platforms; decode/re-encode checks satisfy documented guarantees; no known supported construct uses placeholder behaviour.
