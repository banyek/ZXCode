# ZXCode Text Source Format v0.1

Status: proposed contract.

## Goals

The text format should be:

1. pleasant to edit as UTF-8;
2. visually close to familiar Spectrum BASIC listings;
3. unambiguous enough to encode into authentic Spectrum program bytes;
4. capable of representing non-printing/control bytes when required;
5. suitable for future TAP -> text -> TAP round-trip.

## Physical structure

One physical text line represents one BASIC program line.

```basic
10 BORDER 0: PAPER 0: CLS
20 PRINT AT 10,10;"HELLO"
30 GO TO 20
```

Multiline continuation syntax is intentionally excluded from v1 because it would create a ZXCode source dialect.

## Line numbers

A source line begins with an explicit decimal Spectrum BASIC line number followed by BASIC source text.

Rules to freeze during implementation:

- accepted numeric range;
- whitespace between line number and statement;
- handling of blank/line-number-only lines;
- duplicate numbers;
- ordering of textual lines vs encoded program ordering.

Duplicate line numbers are errors.

## Keyword case

ZXCode source accepts BASIC keywords case-insensitively for editing convenience.

The CST preserves original spelling/case. Semantic identity is canonical.

Formatting may later offer canonical uppercase as an explicit editor action, but the build must not require source rewriting.

## Unicode boundary

The file is UTF-8, but the target machine is not Unicode.

Every source character must therefore fall into one of these categories:

- directly representable Spectrum character;
- ZXCode textual escape representing a Spectrum byte/control sequence;
- source-only whitespace/formatting consumed by parsing;
- unrepresentable character -> compatibility diagnostic.

No silent Unicode transliteration is allowed during build.

## Proposed escape syntax

Use a readable braced form inspired by established Spectrum tooling:

```basic
10 PRINT "{INK 2}HELLO"
20 PRINT "{PAPER 1}{INK 7}WORLD"
```

For bytes/control sequences without a named readable form, provide an explicit byte escape:

```text
{0xNN}
```

Exact syntax remains provisional until tested against:

- literal braces in strings/REM;
- import/export round-trip;
- UDG representation;
- block graphics;
- control-code arguments;
- ambiguity with ordinary source text.

## Design requirement: escaping must be lexical

Escape decoding belongs in the source lexer/string/raw-content layer. It must not be a pre-parser global text replacement because the same visible characters may have different meaning in strings, REM, or normal BASIC syntax.

## Strings

Quoted string content is preserved in the CST.

The encoder converts representable characters/escapes to Spectrum bytes according to the target character map.

A quote inside Spectrum string syntax must follow authentic BASIC rules; do not import modern backslash-string escaping unless explicitly represented as a ZXCode source-format convention and proven necessary.

## REM

REM's tail requires raw preservation.

Escapes inside REM present a policy choice:

- treat escapes as active so arbitrary Spectrum bytes can be authored;
- or preserve all text literally unless a distinct raw-byte notation is used.

Round-trip requirements favour having some explicit raw-byte representation, but the exact policy remains open pending machine-code-in-REM fixtures.

## Source formatting vs encoded form

Textual spaces and case are editor/source concerns. The encoder produces authentic tokenized BASIC according to Spectrum rules, including token bytes and numeric representations.

The project should eventually define two levels of round-trip:

### Semantic round-trip

Imported TAP -> text -> TAP behaves equivalently.

### Binary-preserving round-trip

For supported constructs where preservation matters, imported TAP -> text -> TAP reproduces the same BASIC program bytes.

The second goal is stricter and may require preserving otherwise redundant source details.

## Open questions to resolve with fixtures

- literal `{` / `}` escaping;
- UDG names;
- block graphic notation;
- embedded control codes;
- arbitrary byte escape availability outside strings/REM;
- non-ASCII Unicode diagnostic policy;
- canonical exported spelling for tokens and special characters.
