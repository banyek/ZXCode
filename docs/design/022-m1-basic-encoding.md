# M1 BASIC image encoding

M1-08 encodes only a validated semantic program. Source physical order remains
in the CST; semantic line order is numerical. It emits no TAP metadata.

For the supported literal-only subset, source formatting outside literals is
omitted. Commands become their ROM token byte; colons and PRINT separators remain
explicit bytes. String quotes and validated contents are preserved exactly.
Numeric lexemes retain their spelling followed by the already converted 0Eh/five
storage bytes. Neither BASIC text nor numeric text is reparsed in the encoder.
This freezes normalization only for the M1 subset, not REM or future grammar.

The [Sinclair manual's line layout](https://worldofspectrum.org/ZXBasicManual/zxmanchap24.html)
has a two-byte big-endian line number, two-byte little-endian body length, and
the tokenized body ending in 0Dh. The body length includes that terminator.
[The verified ROM token catalogue](004-rom-token-catalogue.md) supplies PRINT=F5h,
CLS=FBh, and STOP=E2h. Statement mappings start at the command token and exclude
the separating colon and final terminator. All offsets are BASIC-image-relative.
Line mappings include their four-byte headers and terminators.

## Capacity boundary

The M1 build profile caps BASIC images at **32768 bytes**, a conservative tooling
coverage limit for a clean original 48K machine, not the ROM's maximum. It leaves
more than 8K between the usual BASIC start (PROG) and RAMTOP for loader/interpreter
workspace and stacks; see the [Sinclair memory model](https://worldofspectrum.org/ZXBasicManual/zxmanchap24.html)
and [system variables](https://worldofspectrum.org/ZXBasicManual/zxmanchap25.html).
Images beyond this supported budget produce a structured compatibility error,
never a wrapped length field or a nominally successful TAP. Precise maximum-size
and non-default-memory-layout support belongs to later fidelity work. TAP's
65533-byte payload capacity is a separate container limit.

The independent `scripts/research/probe-48k-memory.py` boots the pinned original
ROM using SkoolKit 10.1 and confirms PROG=23755, RAMTOP=65367, and a margin of
8844 bytes after the M1 budget. It imports no ZXCode implementation. This is a
clean-boot capacity observation, not a promise about programs loaded alongside
other resident data or reduced RAMTOP settings.

## Independent hello bytes

`tests/fixtures/hello-program.hex` came from zmakebas 1.3.3, upstream revision
`667090faf392e0083bbcf238084dcdd996957285`, built outside this repository:

```sh
zmakebas -r -o hello-reference.bin tests/fixtures/hello.bas
```

Its 19 bytes also follow directly from the documented fields: line 10, body
length 15, F5h, quoted eleven-character `HELLO WORLD`, and 0Dh. The expected file
was obtained before implementing ZXCode's encoder. Numeric expectations continue
to come from the original ROM fixtures, since independent tokenizers may use
different decimal rounding. A binary mismatch is an investigation, not permission
to regenerate these expectations from ZXCode.

## M2-07 statement map refinement

Conditional AST ownership does not collapse ROM statement maps. IF headers map
through THEN; each tail statement maps separately in ROM execution order. Empty
statement slots have zero-length encoded ranges at their insertion point. The
line map remains flat and the syntax/semantic tree retains nested ownership; M1
maps and golden bytes are unchanged.
