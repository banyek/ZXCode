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
