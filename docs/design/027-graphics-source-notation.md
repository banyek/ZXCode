# Portable graphics and UDG notation (M3-04)

## Decision

Use `{UDG A}` through `{UDG U}` for original 48K user-defined graphic bytes
0x90..0xA4. Use `{BLOCK 0}` through `{BLOCK 15}` for graphics bytes 0x80..0x8F.
The block argument is the decimal quadrant mask, not an ASCII character code:
bit 0 upper-right, bit 1 upper-left, bit 2 lower-right, bit 3 lower-left.

The notation is ASCII within portable UTF-8 source. It never depends on host fonts,
private-use characters, lookalike Unicode blocks or the current bitmap stored in a
UDG slot. A UDG is a mutable byte identity, not another spelling of ASCII A..U.
BLOCK 0 differs from ASCII space even though both may display blank.

Canonical output uses uppercase keywords/UDG letters, one space and decimal
masks without leading zeros. Input recognizes ASCII case differences and ASCII
space/tab padding inside the braces. It rejects UDG V..Z, multi-letter names,
block values outside 0..15, leading-zero masks, signs, expressions, Unicode digit
variants and missing/extra delimiters. This is a byte notation in literal/raw
content, never an expression function, variable name or new BASIC keyword.

## Component and activation boundary

The shared character map owns the bytes and structured export identities. A small
notation component parses/formats these identities, with complete fixed fixtures
for all 37 values and internal byte round trips through M3-03's checked text codec.
There is no second graphic-byte map in an editor or decoder.

M3-05 owns activation within BASIC source, literal-brace escaping and the complete
named/raw escape grammar; this ticket does not turn brace text in existing BASIC
strings or REM into bytes yet. Exact arbitrary-byte notation is also M3-05. The
component established here is reused there, rather than a temporary alternate
source dialect. Display glyphs remain optional previews only.

## Round-trip examples

| Notation | Byte | Structured identity | Canonical output |
|---|---|---|---|
| `{UDG A}` | 90 | UDG A | `{UDG A}` |
| `{udg u}` | A4 | UDG U | `{UDG U}` |
| `{BLOCK 0}` | 80 | Block mask 0 | `{BLOCK 0}` |
| `{BLOCK 1}` | 81 | Upper-right quadrant | `{BLOCK 1}` |
| `{BLOCK 15}` | 8F | All quadrants | `{BLOCK 15}` |

Hexadecimal byte values in this table identify storage only; they are not an
additional accepted argument syntax. An encoded UDG/block byte decodes as an exact
raw text atom in the M3-03 packet codec, then the shared notation formatter selects
its canonical named form. Parsing that form and encoding its byte reproduces the
original value. ASCII 20h, ordinary letters and ROM keyword bytes do not format as
UDG/block notation.

## Provenance

Original Sinclair chapter 14 describes the sixteen graphics symbols and mutable
A..U UDGs. Appendix A establishes their byte ranges. Original ROM PO-GR-1 at 0x0B38
establishes quadrant bit order; the existing independent character verifier checks
all sixteen generated bitmaps. This ticket chooses portable tooling notation for
those established byte identities without changing the source language.
