# Spectrum Character and Control Encoding Plan v0.1

Status: research/fixture plan.

## Separation of concerns

ZXCode must distinguish three encodings:

```text
UTF-8 editor source
       |
source character/escape layer
       |
Spectrum character/token/numeric bytes
       |
BASIC line/program representation
       |
TAP block encoding
```

These are not interchangeable.

## Spectrum text bytes

The target uses the Spectrum character set plus control codes, block graphics and UDG-related character positions. BASIC keywords are represented by token bytes in tokenizable contexts, not by storing their ASCII letters.

A dedicated table should eventually map:

```text
Spectrum byte
canonical exported text
display glyph
category
encoder rules
decoder rules
```

Categories should include:

- printable ASCII-compatible characters;
- Spectrum-specific glyphs;
- block graphics;
- UDG range;
- control codes;
- BASIC tokens.

## Control codes

Colour and formatting controls can occur as encoded bytes with parameters. Text source needs a human-readable representation that survives import/export.

Named forms are preferable when semantics are known:

```text
{INK 2}
{PAPER 4}
```

Raw byte forms remain useful as an escape hatch for unusual programs.

## UDGs

UDGs should have stable textual identities independent of host font rendering. The source notation should not require a Unicode glyph that merely looks similar.

A named form such as `{UDG A}` is easier to understand and round-trip than relying on a private-use Unicode character. Final spelling remains to be chosen.

## Block graphics

Block graphics have the same problem: visual Unicode approximations are not reliable binary identities. Prefer canonical symbolic/byte escapes with optional editor decorations that render the actual Spectrum glyph.

This gives the VS Code extension freedom to display a friendly glyph while keeping the text file portable.

## Editor rendering

Future editor decorations may visually replace escapes with Spectrum glyph previews without changing the underlying UTF-8 source.

That keeps Git diffs and external editors usable.

## Fixtures before freezing syntax

Build a small binary corpus containing:

1. ordinary printable text;
2. every control-code family;
3. representative block graphics;
4. UDG bytes;
5. strings containing braces;
6. REM containing arbitrary bytes;
7. keyword-looking text inside strings and REM.

Decode each fixture to proposed source notation, encode it again, and compare exact BASIC bytes.

Only after this corpus passes should the escape syntax become part of the compatibility contract.

## M3-02 shared byte identities

The original Sinclair [Appendix A](https://worldofspectrum.org/ZXBasicManual/zxmanappa.html)
and original ROM character/font data define a total table for bytes 0..255:
reserved/control positions 00..1F, printable characters 20..7F, sixteen graphics
blocks 80..8F, 21 mutable user graphics A..U at 90..A4, and the shared 91 ROM tokens
A5..FF. The table must reuse token catalogue objects, not duplicate keyword data.
The numeric marker 0E has a separate basic-role annotation for its five-byte
payload; it is not a one-character textual digit or ordinary display glyph.

Every entry has a stable byte identity, category, display hint and structured
export identity. Printable export identities carry their canonical character;
blocks carry their quadrant mask, UDGs their letter, tokens their spelling, and
controls/reserved bytes their named/raw identity. These are internal export data,
not frozen source escape spellings. M3-04/M3-05 still own symbolic graphics and
escape syntax. Display hints are never a reverse mapping for blocks/UDGs/tokens:
ASCII space and graphics block zero, for example, remain different bytes.

Canonical printable glyphs at 5E, 60 and 7F are respectively up arrow, pound and
copyright. ROM font bytes independently corroborate these and resolve transcription
typos in online Appendix A (apostrophe/backslash/tilde). Printable literal mapping
is shared by string and REM checking: ordinary existing ASCII coverage remains,
with £, © and ↑ added at those exact byte values. The existing ASCII caret literal
alias for 5E is retained explicitly; backtick and other lookalike characters are
not aliases. ↑ in expression/operator syntax does not become a power alias.

No implicit Unicode block-glyph or UDG conversion, arbitrary byte expansion,
global keyword substitution or new brace/backslash escaping is enabled. Literal
braces/backslashes keep their bytes. The decoder-facing lookup returns the same
immutable records consumed by literal encoding, so later import cannot maintain a
separate character map. Unknown/out-of-range byte lookups fail explicitly.

ROM PO-GR-1 at 0x0B38 independently constructs all sixteen block bitmaps: mask
bits 0, 1, 2, 3 select upper-right, upper-left, lower-right, lower-left. Six fixed
font glyphs and all sixteen generated blocks are recorded in characters-rom.json
and rechecked by scripts/research/verify-characters-rom.py. The normal 167-test
Node 24 suite verifies all byte categories, immutable export identities, shared
token objects, direct literal emission and preserved context boundaries.

## M3-03 control packets and internal text round trip

Sinclair chapters 15/16 and ROM PO-1-OPER/PO-2-OPER establish byte packets:
INK/PAPER/FLASH/BRIGHT/INVERSE/OVER (16..21) each consume one following byte;
AT/TAB (22/23) each consume two. AT uses row then column; TAB uses low then high
bytes. Parameter bytes are payload, even if they equal quotes, colons, control
codes or keyword tokens. Standalone editor/display controls use no parameters.
In text, byte 14 remains a raw byte: its five-byte numeric payload role applies
to BASIC numeric storage context, not arbitrary string data.

A shared internal text model has literal text, named control packets and raw byte
atoms. Semantic conversion validates literal mappings, control identity/arity and
integer byte bounds, returning structured issues with item/UTF-16 offsets. It
copies/freezes accepted atoms and bytes; the encoder consumes only the checked
value and returns owned bytes. String/REM checking reuses the literal conversion
path with source-range adapters. No source escape spelling is enabled here.

A host-independent text-byte decoder groups known complete control packets and
canonical printable runs using the same character table. Reserved/graphics/UDG/
token bytes remain explicit raw atoms until source-format export rules apply.
Truncated controls report byte-offset issues and retain every byte as raw data;
no parameter padding, dropping or recursive interpretation occurs. Encoding the
decoded atoms therefore preserves every input byte, including malformed packets.
Canonical complete text/control atoms also round-trip as internal atoms. This is
text packet decoding only, not the M3-08 BASIC/TAP import spike.

This layer validates representation, not screen execution: parameters must be
integers 0..255, with the correct packet count. Runtime colour/coordinate domains
remain contextual (screen/printer/REM may treat them differently), just as for
existing BASIC expression operands. Raw atoms are the explicit exact-byte path.
Named/raw source forms and brace escaping remain the separate M3-05 design gate.

BASIC string framing of control payload bytes that equal a quote, carriage return
or other delimiter remains an explicit M3-05/M3-06 fixture question. Packet encoding
returns those bytes verbatim and does not pretend that ordinary doubled-quote
framing is already sufficient for every raw control payload.

M3-03 validation: all 16 named control families have independently checked original
ROM dispatch/arity and fixed packet fixtures. The full 173-test Node 24 suite
checks canonical internal round trips, every byte value, malformed packet retention,
invalid parameters, ownership and source diagnostic regressions.

M3-04 freezes portable graphics/UDG forms and all 37 byte round-trip examples in
[027-graphics-source-notation.md](027-graphics-source-notation.md). BASIC source
activation and literal-brace rules remain M3-05.
