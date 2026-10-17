# ZXCode Text Source Format v0.1

Status: M1 physical-line rules are an implementation contract; the escape and
special-character proposals below remain provisional.

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

### M1 decision and evidence

The [original Sinclair manual, chapter 2](https://worldofspectrum.org/ZXBasicManual/zxmanchap2.html)
states that program line numbers are whole numbers from 1 through 9999 and shows
that entering line 20 before line 10 still stores and lists them in numerical
order. It also describes a number-only entry as an interactive deletion command.
ZXCode source files are program snapshots rather than transcripts of interactive
editing. The following explicit source-file policies settle the M1-04 gate:

- Each nonblank physical line has an ASCII decimal line number in **1..9999**.
  Leading zeroes are permitted and preserved as source spelling; identity uses
  the decimal value, so `0010` and `10` are duplicates. Signs, decimal points,
  exponents, and non-ASCII digits are not line-number notation.
- Leading ASCII spaces/tabs are source formatting. At least one ASCII space or
  tab separates the line number from its BASIC body; `10PRINT` is diagnosed as
  an invalid source line-number field. No Unicode whitespace is silently folded
  into this prefix convention.
- Empty and ASCII-space/tab-only physical lines are preserved in syntax but do
  not create BASIC program lines. LF, CRLF, and CR are physical terminators; a
  trailing terminator retains the final empty physical line for source locations.
- A number-only line is an incomplete program line with a missing-statement
  syntax diagnostic. It never deletes or replaces another line in a source file.
- Duplicate numeric identities are errors with a related range pointing to the
  first occurrence. There is no last-definition-wins interpretation.
- Syntax retains **physical file order**, all ranges, and original text. File
  order need not be ascending. Semantic/build output uses ascending BASIC line
  numbers while keeping each node's original source identity/range. The scanner
  does not sort or rewrite source and does not invent implicit numbers.
- Missing/malformed headers produce recoverable invalid-line nodes. Scanning
  resumes at the next physical line. Body spelling, case, strings, trailing
  spaces, and potential REM content are untouched by header scanning.

Whitespace separation, blank-line handling, and retaining unsorted source are
text-file conventions, not new BASIC statements. Numeric ordering and the valid
line-number range follow Sinclair's stored-program model. Syntax recovery can
retain incomplete lines for editing without accepting them for a binary build.
Other escape, normalization, and special-character questions remain open.

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

## M2-09 string-quote refinement

Original Sinclair chapter 7 and the original S-QUOTE scanner establish doubled
quotes for an interior quote. This authentic form is now in coverage. Syntax
retains original content plus decoded source parts; semantic string bytes contain
a single quote, and the BASIC encoder doubles it for storage. Other character,
control and escape decisions above remain provisional.

## M2-14 REM raw-tail contract

Original Sinclair Appendix C defines REM's remainder as a comment. Independent
48K ROM STMT-L-1 probes verify that colons, quotes, numeric-looking text and token
bytes after REM do not create statements or expression syntax. The ROM syntax
checker returns with CH_ADD at the first nontrivia tail byte; the research verifier
records that unconsumed tail length explicitly instead of assuming ordinary
statement consumption.

A source REM node owns the exact range immediately after its keyword through the
physical line end, including all spaces, case, punctuation and unmatched quotes.
It also works after colons and IF/THEN. No text in that range is keyword-tokenized,
number-encoded, quote-decoded or escape-expanded. The encoder emits the REM token
and checked literal tail bytes. A bare REM has an empty range and no synthetic
space. A source space after REM is a literal comment byte and remains in output.

This ticket uses the existing literal character coverage: ASCII 32..126 except
backtick (Spectrum 0x60 is pound). Tabs and other Unicode/control characters are
preserved in the source node but receive precise compatibility diagnostics rather
than substitution. Literal braces and backslashes remain literal. Arbitrary byte,
Spectrum character mapping and escape-policy decisions remain deferred to M3.
