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

DATA contains numeric or string expressions, evaluated when READ consumes them, and has a dedicated grammar and preservation strategy. Its behaviour must be tested against ROM fixtures rather than assumed to be ordinary expression-list parsing.

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

## M2-09 PRINT/LPRINT research contract

Sources: original Sinclair manual Appendix C (PRINT items/separators and printer
behaviour), chapter 7 (doubled string quotes), and ROM routines
[PR-ITEM-1](https://skoolkit.ca/disassemblies/rom/hex/asm/1FFC.html) and
[S-QUOTE](https://skoolkit.ca/disassemblies/rom/hex/asm/25B3.html).
Fixed original-ROM statement probes verify accepted/rejected item boundaries.

PRINT/LPRINT are ordered item streams. Both accept numeric/string expressions,
AT row,column, TAB column, the six colour controls, # numeric stream changes,
and empty items. Items are separated by semicolon, comma or apostrophe; leading,
repeated and trailing separators are authentic. Adjacent formatting/expression
items without a separator are rejected, as confirmed by the ROM. AT's coordinate
comma belongs to the AT item; a following comma is a PRINT separator. Arguments
inside expression function parentheses retain their own expression grammar.

Each item has a distinct semantic kind and range; empty item insertion points and
all separators remain explicit. AT/TAB/control/channel arguments must be numeric;
ordinary expressions may be numeric or string. No synthetic control-code bytes or
separators are inserted by the encoder: it emits source item tokens, expressions
and separators. PRINT and LPRINT differ in their initial opcode/default output
path, not accepted item syntax. LPRINT permits AT/colour/channel items as the ROM
does; the printer ignores AT's row, supports INVERSE/OVER but not screen colours,
and loses output if no printer is present. No new static hardware error is added.

Authentic doubled quotes are enabled in this ticket (previously outside M1
coverage): `"a""b"` is one string whose value contains one interior quote. The
lexer preserves raw content/ranges and records decoded source parts. Diagnostics
inside a later part therefore still point to the original UTF-16 source, even
after an escaped quote. The encoder doubles interior quote bytes again for ROM
storage. Backslashes remain literal; no modern escape language or provisional
braced Spectrum-byte escapes are introduced. All original M1 golden bytes remain
unchanged. Incomplete quoting and malformed item delimiters retain error state
so removing diagnostics alone cannot enable a build.

## M2-10 INPUT research contract

Sources: original Sinclair manual Appendix C (INPUT) and the original
[INPUT routine](https://skoolkit.ca/disassemblies/rom/hex/asm/2089.html), especially
IN-ITEM-1 at 0x20C1, LINE handling at 0x20D8 and variable dispatch at 0x20ED.
Independent syntax-mode probes distinguish read targets from display-only items.

INPUT has its own item stream, not a reused PrintItem array. Its item kinds are:
assignable target (with per-item LINE flag), display item, parenthesized display
group, separator and empty insertion point. Numeric/string scalar targets reuse
LET's target grammar and identities; array/slice targets remain explicit coverage
errors until M2-11 extends that shared target union.

At an input target position, a raw letter name is a read target, so `INPUT a+1`
is invalid. Prefix-function/value tokens, literals, AT/TAB, colour controls and
stream changes are display items. In text, established keyword-prefix roles take
priority; spaced raw names can retain their ordinary name identity. Parentheses
at item start invoke the ROM PRINT-item subgrammar: `INPUT (a;b$);c` displays a
and b$ and then reads c. The group is not an expression argument list and does
not turn its bare names into input targets. Nested expression parentheses inside
that group continue to use the common expression parser. The encoder preserves
parentheses, separators and control tokens without inserting a PRINT opcode.

LINE requires an assignable string target; it changes how that one input value is
read, not the variable's type. It may occur after other items, and later targets
need not use LINE. Scalar target/result context checks remain semantic diagnostics;
nonassignable expressions and missing delimiters are syntax errors.

Separators match PRINT (semicolon/comma/apostrophe), including leading/repeated/
trailing forms. Bare INPUT with no item/separator is invalid, while an empty
parenthesized display group is authentic. Adjacent items still require separators.
Display typing/encoding reuses the low-level PRINT item helpers; INPUT retains its
own target and group structure. All original M1/PRINT fixtures stay fixed.

## M2-12 DATA/READ/RESTORE research contract

The original Sinclair [chapter 6](https://worldofspectrum.org/ZXBasicManual/zxmanchap6.html)
defines DATA as comma-separated numeric or string expressions. Variables and dynamic
functions remain expressions; evaluation happens during READ, not compilation or
ordinary execution of DATA. Unquoted names are variables, never implicit strings.
The original ROM statement syntax checker (STMT-L-1 at 0x1B29, pinned 48K ROM
SHA-256 d55daa439b673b0e3f5897f99ac37ecb45f974d1862b4dadb85dec34af99cb42)
independently accepts expression lists and rejects empty DATA and leading/trailing
commas. Dedicated nodes retain expressions, comma ranges and completeness, using
the shared expression model and literal storage without compile-time evaluation.

READ requires a nonempty comma-separated list of assignable targets. The same ROM
checker accepts array and string-slice targets and rejects an empty list, trailing
comma and arithmetic target. READ therefore shares LET/INPUT target parsing,
identities, numeric index checks and emission. Presentation items, LINE and
semicolon separators are not READ syntax. Recovery remains within each statement.

RESTORE retains the existing optional numeric expression command. Omission resets
the data pointer to the beginning; an operand selects the first DATA at or after
that line number. No exact-line warning is appropriate. String operands are type
errors. Data availability, pointer movement, declaration/dimension availability
and correspondence between READ target types and DATA values depend on runtime
control flow; no speculative static errors are introduced for those conditions.
Quoted commas, colons and doubled quotes remain literal contents through the
shared string model, while ordinary colons separate statements. Neither DATA nor
READ introduces a raw-tail lexer mode or a foreign BASIC dialect's data syntax.

## M2-13 DEF FN/FN research contract

Original Sinclair chapter 9 establishes single-letter function/formal names with
optional `$`, mandatory parentheses with zero or more arguments, and result type
from the function name. Formals shadow globals only in their own function body;
a called function does not inherit its caller's formals. ROM routine
[S-FN-SBRN](https://skoolkit.ca/disassemblies/rom/hex/asm/27BD.html) searches stored
program order for the first matching function name/type and checks argument count
and types at runtime. Calls retain arguments and an optional definition range;
forward definitions and nested IF tails participate. Missing definitions produce
semantic warnings, while a resolvable parameter count/type mismatch is a semantic
error. No function execution, recursion restriction or declaration-before-use
rule is introduced. Duplicate definitions retain first-match lookup semantics.

Independent syntax-mode ROM probes at STMT-L-1 verify empty/multiple parameter
lists, result/body type checking, and duplicate formal acceptance. Duplicates are
preserved, with first-match local binding, rather than introducing a new syntax
restriction. Formal references retain their owning definition/parameter range and
local identity; numeric array names remain a separate family. The common expression
visitor receives explicit immutable function context, never ambient mutable state.

The ROM inserts six storage bytes after each formal name: marker 0x0E and five
value bytes (also for string formals). Encoder output reserves zeroed value bytes,
independently compared with zmakebas; calls contain no such formal storage. The
standalone ROM verifier accounts for observed insertion lengths explicitly, so
ordinary statement cases still require exact original input consumption. Function
calls can be sliced when string-valued; incomplete delimiters/names/formals/bodies
remain recoverable but cannot become buildable by stripping diagnostics.

The five reserved formal value bytes are not initialized by ROM syntax checking;
the compiler writes deterministic zeros because FN execution fills them before
use. zmakebas agrees for nonempty lists but inserts an extraneous storage slot for
`DEF FN f()=...`; empty-list fixtures therefore use the original-ROM observation
(no insertion), not that comparison tool's output.

## M2-15 LIST/LLIST and cassette research contract

The ROM [LIST entry](https://skoolkit.ca/disassemblies/rom/hex/asm/17F9.html)
accepts an optional numeric starting line or an explicit # numeric stream with an
optional comma/semicolon followed by a mandatory numeric starting line. LIST and
LLIST share this grammar and differ in their default channel. No ending line,
TO range, bare comma-list or implicit channel separator is introduced. Omitted
operands remain omitted; no exact-line warning is emitted for listing start lines.

Original Sinclair chapter 20 and the ROM
[SAVE-ETC routine](https://skoolkit.ca/disassemblies/rom/hex/asm/0605.html) establish
four commands with a string filename expression and one explicit suffix form:
program (no suffix), SAVE-only LINE numeric expression, DATA one-letter numeric
or string array name followed by empty parentheses, SCREEN$, or CODE operands.
MERGE accepts only the program form. SAVE CODE requires both numeric start and
length; LOAD/VERIFY CODE permit neither, start alone, or start and length. Empty
operands after an explicit comma are errors. No alternate DATA a()$ spelling,
subscripted DATA selection or combined suffixes are accepted. Independent original
ROM syntax probes confirm these boundaries, including documentation typos.

Source and typed nodes keep the command, filename, suffix kind and ranges,
optional numeric operands and array identity, not a generic argument list.
Filename expression parsing treats cassette suffix keywords as contextual name
boundaries (like existing TO/STEP boundaries); builtin prefix expressions such as
STR$ CODE "x" remain expressions. Numeric/string checks and FN context use the
common expression visitor. Native suffix tokens are emitted without expansion:
SCREEN$ does not become CODE constants, and omitted CODE operands stay omitted.
Runtime filename lengths, memory addresses, existing array contents and cassette
availability are not new static errors or host file operations. These statements
encode the program's ROM commands; they do not change build artifact metadata.
