# Special Statement Grammars v0.1

Status: parser-facing design; exact edge cases remain fixture-driven.

## Why these need dedicated parsers

The ROM's generic command classes deliberately hand several commands to command-specific syntax routines. ZXCode should mirror that conceptual boundary instead of treating them as comma-separated argument lists.

## PRINT / LPRINT

PRINT is an item stream, not a conventional function call.

The parser needs item nodes such as:

```text
PrintExpression
PrintSeparator       ; or ,
PrintAt              AT row,col
PrintTab             TAB column
PrintControl         INK/PAPER/FLASH/BRIGHT/INVERSE/OVER ...
PrintChannel         # channel
EmptyPrintItem
```

A PRINT statement may contain multiple adjacent formatting/control and expression items. Separators affect output position and therefore belong in the syntax/semantic model rather than trivia.

LPRINT shares much of the item grammar but targets the printer path.

### Completion

At a PRINT item boundary, completion can offer:

- expressions;
- `AT`;
- `TAB`;
- colour/control items;
- channel syntax where valid.

## INPUT

INPUT also has an item stream and shares some presentation syntax with PRINT, but its semantic targets differ.

The AST should distinguish:

- prompt/display expressions;
- input variable targets;
- separators;
- formatting/control items;
- `LINE` input form.

Do not reuse `PrintItem[]` directly. Shared low-level formatting nodes are fine, but INPUT requires assignable-target validation.

## READ

READ consumes a list of assignable variables:

```basic
10 READ A,B$,C(2)
```

Semantic analysis must validate assignability and variable/array shape.

## DATA

DATA contains expression-like constant data items but should have a dedicated grammar and preservation strategy. Its behaviour must be tested against ROM fixtures rather than assumed to be ordinary expression-list parsing.

The parser should retain enough source information for exact encoding and future round-trip work.

## DIM

DIM declares one or more array dimensions.

Examples of semantic shapes:

```text
NumericArray(name, dimensions[])
StringArray(name$, dimensions[])
```

Dimension expressions are numeric. The exact Spectrum distinction between string arrays and slicing/indexing is handled by the expression grammar and symbol model.

## DEF FN

DEF FN creates a user-defined numeric or string function using formal single-letter arguments according to Spectrum BASIC rules.

Suggested AST:

```text
DefFnStatement
  name
  parameters[]
  body: Expression
```

Function-name/result type and formal-parameter rules must be derived from authentic Spectrum naming rules, not generic BASIC assumptions.

Calls become `UserFunctionCall` nodes linked semantically to a matching definition when resolvable.

## LIST / LLIST

LIST-family grammar deserves its own range/start-line representation rather than being parsed as an arbitrary expression list. Exact accepted forms should be fixture-verified.

## IF ... THEN

Spectrum IF uses a numeric condition followed by THEN and a statement tail.

The THEN tail belongs to the same physical BASIC line. The parser must preserve colon-separated statement sequencing and support recovery inside the tail.

Suggested structure:

```text
IfStatement
  condition: Expression
  thenStatements: StatementSequence
```

## Statement separators

Colon is structurally significant:

```basic
10 LET A=1: PRINT A: GO TO 10
```

A physical BASIC line therefore contains:

```text
BasicLine
  lineNumber
  StatementSequence
    Statement
    :
    Statement
    :
    Statement
```

REM terminates ordinary statement parsing for its remainder according to ROM semantics and must be treated specially.

## Error recovery

For editor use, malformed special grammars should recover at the safest authentic boundaries:

- comma/semicolon where the local grammar permits;
- colon statement separator;
- physical line end.

Recovery tokens must remain in the CST so diagnostics can underline the correct source range.

## M2-07 control-flow and sequence contract

Original Sinclair manual [chapter 3](https://worldofspectrum.org/ZXBasicManual/zxmanchap3.html)
and [Appendix C](https://worldofspectrum.org/ZXBasicManual/zxmanappc.html) establish
that IF's THEN tail comprises the entire remaining physical line. A false
condition skips that whole tail; colon does not end the conditional. Nested IF
nodes therefore own nested statement sequences. There is no ELSE or implicit
`THEN line-number` shorthand. GO TO and GO SUB keep their numeric expression
operands; RETURN reuses the already implemented no-operand ROM command.

The source uses canonical `GO TO` / `GO SUB` word sequences (case insensitive,
ASCII space/tab formatting). No GOTO/GOSUB aliases are introduced by this ticket.
Numeric conditions/targets use the common expression parser and type checker.

The [original statement loop](https://skoolkit.ca/disassemblies/rom/hex/asm/1B28.html)
accepts empty colon slots and an empty THEN tail. These are represented explicitly
as empty statement nodes, rather than errors from the earlier M1 subset. Number-
only physical source lines remain incomplete snapshots per the source-file policy.
The loop also limits SUBPPC to 127 statements per line: IF headers and empty slots
count. Fixed original-ROM syntax observations verify empty cases and the 127/128
boundary. Excess statements produce compatibility errors, never truncated output.

IF nodes retain both full subtree range and a header range ending at THEN. Encoded
statement maps flatten actual ROM statement order: IF's header maps separately
from each statement in its tail, with empty slots represented as zero-length maps.
The AST keeps conditional ownership; the encoder preserves literal colon and THEN
boundaries. Recovery stays within the physical line; an incomplete IF retains
later colon groups but cannot become buildable after diagnostics are stripped.
The lexer recognizes statement start after THEN only while scanning an IF, so REM
raw tails there preserve keyword-looking/quoted/colon content (REM build support
still belongs to its dedicated issue).

### Static line-reference relations

Validated numeric/BIN literal nodes whose stored ROM value is an exact integer in
1..9999 receive a line-reference relation, with the exact definition range when
present. Forward references work independently of physical file order. Expressions,
parenthesized forms and unary expressions remain expressions and are not folded.
Zero and fractional/out-of-snapshot-range literals do not gain a misleading exact
line relation. A missing exact literal line produces a semantic warning, never a
build error. The wording does not claim a runtime failure: the ROM selects the
first line after that number when no exact line exists. No new static control-flow
reachability, undefined-variable or subroutine-stack rule is introduced.

## M2-08 FOR/NEXT contract

Original Sinclair [chapter 4](https://worldofspectrum.org/ZXBasicManual/zxmanchap4.html)
requires a single-letter control variable and numeric initial value, limit and
optional STEP expression. These may be fractional, negative or variable-valued;
STEP zero is authentic syntax, not a static error. Omitted STEP remains omitted
in the source model/bytes; the ROM supplies one at runtime.

FOR nodes retain the checked control-variable target, start, limit and optional
step. NEXT requires exactly one single-letter variable (no omitted variable or
comma-list shorthand). Control identity shares the numeric scalar family from
M2-03. Each expression uses M2-04 type checks. Missing equals/TO/STEP values and
extra operands retain recoverable incomplete nodes; stripped parser diagnostics
cannot make them buildable. NEXT without a preceding statically visible FOR is
not a syntax/type error: runtime control flow determines whether the loop state
exists. No modern loop syntax or block-matching rule is introduced.

Both commands remain ordinary statements inside colon/IF sequences. Independent
program bytes and original-ROM syntax/type observations cover omitted/explicit
STEP, numeric/string bounds, invalid names and NEXT's mandatory single variable.
