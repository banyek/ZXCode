# ZX Spectrum 48K BASIC Grammar Inventory v0.1

Status: ROM-derived baseline.

## ROM command grammar

The original 48K ROM contains an offset entry for exactly fifty BASIC commands. Each points into a compact parameter table. ZXCode should model these ROM command classes explicitly rather than approximating the language from examples.

### ROM command classes

| Class | ROM meaning | Parser abstraction |
|---|---|---|
| 00 | no further operands | end-of-statement |
| 01 | LET variable required | assignable target |
| 02 | LET expression required | typed expression |
| 03 | optional numeric expression; default zero | optional numeric expression |
| 04 | single-character variable | scalar loop variable |
| 05 | set of items may be given | command-specific item grammar |
| 06 | numeric expression required | numeric expression |
| 07 | colour item | colour/control expression |
| 08 | two numeric expressions separated by comma | numeric pair |
| 09 | class 08 with colour items allowed before it | optional colour controls + numeric pair |
| 0A | string expression required | string expression |
| 0B | cassette command grammar | SAVE/LOAD/VERIFY/MERGE special grammar |

Class 05 is deliberately not represented as a generic list parser. PRINT, INPUT, DIM, REM, READ, DATA, LIST and DEF FN share the ROM dispatch class while having materially different internal grammar.

## Fifty ROM commands

The ROM syntax table covers, in token order:

`DEF FN`, `CAT`, `FORMAT`, `MOVE`, `ERASE`, `OPEN #`, `CLOSE #`, `MERGE`, `VERIFY`, `BEEP`, `CIRCLE`, `INK`, `PAPER`, `FLASH`, `BRIGHT`, `INVERSE`, `OVER`, `OUT`, `LPRINT`, `LLIST`, `STOP`, `READ`, `DATA`, `RESTORE`, `NEW`, `BORDER`, `CONTINUE`, `DIM`, `REM`, `FOR`, `GO TO`, `GO SUB`, `INPUT`, `LOAD`, `LIST`, `LET`, `PAUSE`, `NEXT`, `POKE`, `PRINT`, `PLOT`, `RUN`, `SAVE`, `RANDOMIZE`, `IF`, `CLS`, `DRAW`, `CLEAR`, `RETURN`, `COPY`.

## Directly ROM-described statement shapes

| Statement | ROM parameter skeleton | ZXCode parser direction |
|---|---|---|
| LET | class 01, `=`, class 02 | assignment target + typed expression |
| GO TO | class 06 | numeric expression; literal line reference may receive navigation semantics |
| IF | class 06, `THEN`, class 05 | numeric condition + THEN command/statement sequence |
| GO SUB | class 06 | numeric expression |
| STOP | class 00 | no operands |
| RETURN | class 00 | no operands |
| FOR | class 04, `=`, class 06, `TO`, class 06, class 05 | loop variable, start, end, optional STEP grammar |
| NEXT | class 04 | single-character loop variable |
| PRINT | class 05 | dedicated print-item grammar |
| INPUT | class 05 | dedicated input-item grammar |
| DIM | class 05 | dedicated dimension grammar |
| REM | class 05 | dedicated raw-tail handling |
| NEW | class 00 | no operands |
| RUN | class 03 | optional numeric expression |
| LIST | class 05 | dedicated listing grammar |
| POKE | class 08 | numeric expression, numeric expression |
| RANDOMIZE | class 03 | optional numeric expression |
| CONTINUE | class 00 | no operands |
| CLEAR | class 03 | optional numeric expression |
| CLS | class 00 | no operands |
| PLOT | class 09 | optional colour items + numeric pair |
| PAUSE | class 06 | numeric expression |
| READ | class 05 | dedicated variable-list grammar |
| DATA | class 05 | dedicated data-item grammar |
| RESTORE | class 03 | optional numeric expression |
| DRAW | class 09 then class 05 | colour controls + x,y + optional third expression |
| COPY | class 00 | no operands |
| LPRINT | class 05 | PRINT-family item grammar |
| LLIST | class 05 | LIST-family grammar |
| SAVE | class 0B | cassette grammar |
| LOAD | class 0B | cassette grammar |
| VERIFY | class 0B | cassette grammar |
| MERGE | class 0B | cassette grammar |
| BEEP | class 08 | duration, pitch |
| CIRCLE | class 09 then class 05 | colour controls + x,y + radius |
| INK/PAPER/FLASH/BRIGHT/INVERSE/OVER | class 07 | colour/control item |
| OUT | class 08 | port, value |
| BORDER | class 06 | numeric expression |
| DEF FN | class 05 | dedicated function-definition grammar |
| OPEN # | class 06, comma, class 0A | channel expression, string expression |
| CLOSE # | class 06 | channel expression |
| FORMAT | class 0A | string expression |
| MOVE | class 0A, comma, class 0A | string expression, string expression |
| ERASE | class 0A | string expression |
| CAT | class 00 | no operands |

The Interface 1-oriented entries above are authentic ROM grammar entries even when the bare-machine runtime cannot provide the intended service.

## AST implications

Statements should have dedicated node types where their grammar or language-service behaviour differs. Examples:

```text
GotoStatement
  target: Expression
  literalTarget?: LineReference

ForStatement
  variable: ScalarNumericVariable
  start: Expression
  end: Expression
  step?: Expression

PrintStatement
  items: PrintItem[]

RemStatement
  rawTail: SourceSlice
```

A literal line number inside GO TO/GO SUB/RESTORE/RUN/LIST can be decorated with semantic line-reference information without pretending that the ROM grammar only permits literals.

## Completion implications

Completion follows grammar position:

- after a statement separator: command tokens;
- after `GO TO` / `GO SUB`: expression completion plus existing line numbers as high-value semantic suggestions;
- after `FOR X=`: numeric expression completion;
- after the end expression of FOR: `STEP` is a contextual completion;
- inside PRINT/INPUT: their dedicated item grammar determines `AT`, `TAB`, colour controls, separators, variables, etc.;
- after `IF <expr>`: `THEN` is the structural completion.

The completion engine should consume parser state, not maintain a second hand-written approximation of BASIC syntax.

## Remaining command-level research

Class 05 and class 0B require dedicated subgrammars. The next pass should specify PRINT, INPUT, DATA, READ, DIM, DEF FN, LIST/LLIST, IF-THEN statement tails and cassette command forms in detail.

## M2-05 simple-command implementation contract

The shared simple-command model covers the thirty entries below. Helpers follow
ROM class 00/03/06/07/08/0A shapes; graphics retain a dedicated ordered colour
prefix plus coordinate/angle/radius grammar. No class-05 item grammar is replaced
by an arbitrary comma-list parser. Existing CLS/STOP nodes remain compatible.

- No operand: STOP, RETURN, NEW, CONTINUE, CLS, COPY, CAT.
- Optional numeric expression: RUN, RANDOMIZE, CLEAR, RESTORE.
- Required numeric expression: BORDER, PAUSE, CLOSE #.
- Colour/control expression: INK, PAPER, FLASH, BRIGHT, INVERSE, OVER.
- Numeric pair: POKE, OUT, BEEP.
- Graphics: PLOT x,y; DRAW x,y with optional comma/angle; CIRCLE x,y,r.
  Each permits a leading sequence of colour/control expressions, each followed
  by comma or semicolon; those separators are retained and encoded. See original
  Sinclair [chapter 17](https://worldofspectrum.org/ZXBasicManual/zxmanchap17.html).
- Required string expression: FORMAT, ERASE. MOVE has two string expressions.
- OPEN # has numeric stream, comma, string channel expression. The hash is part
  of the ROM token spelling, not an extra byte after the encoded token. CLOSE #
  likewise emits its combined token. Text permits whitespace around the hash.

Operand types are checked by the shared M2-04 visitor. Omitted optional operands
remain omitted bytes (the ROM supplies defaults). Runtime value/range errors are
not invented as new syntax restrictions. Missing commas/required operands and
extra operands produce recoverable syntax errors; a completeness flag and checked
operand arity prevent stripped parser diagnostics from making bad nodes buildable.

CAT/FORMAT/MOVE/ERASE/OPEN #/CLOSE # are parsed, typed and have encoder fixtures,
but public builds retain an explicit *implementation coverage* diagnostic until
the M2-16 capability policy is resolved. This is not a decision that all six need
extra hardware: original manual chapter 22 and actual ROM channel behaviour need
to be reconciled in that research/design ticket. Internal encoder unit fixtures
exercise their validated semantic nodes; the public encoder still requires a
BuildableProgram. No runtime-profile severity/default-completion decision is made
here. All six continue to be known vocabulary, never unknown keywords.

Fixed simple-command program bytes are independently produced with the pinned
zmakebas reference recorded in M1 research. Source cases and raw bytes are kept
as fixtures. Graphics controls, both coordinate counts, string arguments and
omitted optional operands have explicit cases; special item grammars remain
separate tickets.
