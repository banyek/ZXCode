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
