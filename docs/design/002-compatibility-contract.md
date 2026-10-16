# ZXCode Compatibility Contract v0.1

Status: draft.

M1 implementation refinements are explicit in [physical source rules](011-text-source-format.md),
[numeric conversion](020-numeric-literals.md), [supported syntax](021-m1-supported-subset.md),
[BASIC image encoding](022-m1-basic-encoding.md), and [CLI build policy](023-m1-cli-build-policy.md).
The [M1 acceptance proof](024-m1-acceptance.md) covers that subset; it does not
resolve the remaining full-language or production-integration questions below.

## Target

ZXCode v1 targets the original **Sinclair ZX Spectrum 48K and its ROM BASIC**.

Not part of the initial compatibility target:

- ZX Spectrum 128 BASIC;
- +2/+3-specific behaviour;
- Timex variants;
- ZX Spectrum Next BASIC;
- Beta BASIC or other extensions.

## Primary contract

If ZXCode accepts a source program without compatibility errors and successfully builds it, the resulting BASIC program must be representable as an authentic program loadable on an original ZX Spectrum 48K.

An emulator is useful for execution and testing, but emulator-specific extensions do not define compatibility.

## Text source

The working source format is UTF-8 text representing authentic, line-numbered Spectrum BASIC.

Current rules:

- one source program consists of explicitly numbered BASIC lines;
- duplicate line numbers are errors;
- keyword matching in source may be case-insensitive, while encoding uses original Spectrum tokens;
- quoted strings and REM require context-sensitive treatment;
- no ZXCode-only statements or control structures are introduced.

The exact textual representation of Spectrum control codes, block graphics, UDG references, and other non-trivial character-set values remains an open design decision.

## Diagnostics

ZXCode distinguishes:

- **syntax error** — source cannot form valid target BASIC;
- **compatibility error** — construct is outside the ZX Spectrum 48K target;
- **warning** — target BASIC may accept the program, but static analysis found suspicious behaviour;
- **hint/info** — editor assistance with no effect on compatibility.

Static analysis must not redefine compatibility.

For example, a missing literal GO TO target can be reported as a warning rather than pretending the ROM would reject the source as syntax. Likewise, range analysis may warn about an obviously invalid constant argument without rejecting expressions merely because they could evaluate to an invalid runtime value.

## Encoding

The build path is conceptually:

```text
UTF-8 .bas
   -> lexer/parser
   -> Spectrum BASIC representation
   -> Sinclair token/numeric/character encoding
   -> BASIC program bytes
   -> TAP writer
```

Encoding must be deterministic.

Numeric literals require authentic Spectrum numeric representation; they are not handled as keyword/string substitution.

REM is special territory and must preserve the semantics required for authentic old programs, including programs that use REM contents as data.

## Round-trip direction

A later import path should aim for semantic/binary preservation:

```text
program.bas -> ZXCode -> program.tap
program.tap -> ZXCode import -> textual BASIC
```

The imported text does not need to reproduce original formatting byte-for-byte, but supported content should be exportable again without changing the Spectrum program's meaning or encoded content where preservation is required.

## Open questions

- canonical textual escape syntax for Spectrum control codes and special characters;
- exact whitespace/case normalization policy;
- degree of losslessness required from parser/AST;
- full-fidelity TAP metadata beyond the explicit M1 build defaults;
- first production external-emulator integration (M1's headless reference target is selected).
