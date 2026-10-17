# ZX Spectrum 48K Expression Semantics v0.2

Status: M2-04 expression typing contract below; arrays, slices and FN binding remain later issues.

## Runtime expression result types

The ROM expression scanner explicitly distinguishes numeric and string results. Numeric results are calculator-stack floating-point values; string results are represented by address/length parameters. ZXCode therefore needs numeric-vs-string typing in the semantic model even though both live under one expression grammar.

## Primary expression forms

Parser primary/prefix forms must include:

- numeric literals, including decimal/exponent forms and the `BIN` form;
- string literals;
- numeric variables;
- string variables;
- numeric array elements;
- string array elements and slices;
- parenthesized expressions;
- zero-argument values such as `RND`, `PI`, `INKEY$`;
- user-defined `FN` calls;
- built-in prefix functions;
- unary `+`, unary `-`, and `NOT`.

The ROM scanner documentation explicitly uses `A$(4,3 TO 7)` as a valid single operand, confirming that string array access and slicing belong inside primary-expression parsing rather than being bolted on after generic expression parsing.

## Built-in function catalogue

Working signatures for the ROM vocabulary:

| Function/value | Input | Result |
|---|---|---|
| RND | none | Numeric |
| INKEY$ | none | String |
| PI | none | Numeric |
| FN | user-defined arguments | Numeric or String according to definition/name |
| POINT | numeric, numeric | Numeric |
| SCREEN$ | numeric, numeric | String |
| ATTR | numeric, numeric | Numeric |
| VAL$ | string | String |
| CODE | string | Numeric |
| VAL | string | Numeric |
| LEN | string | Numeric |
| SIN | numeric | Numeric |
| COS | numeric | Numeric |
| TAN | numeric | Numeric |
| ASN | numeric | Numeric |
| ACS | numeric | Numeric |
| ATN | numeric | Numeric |
| LN | numeric | Numeric |
| EXP | numeric | Numeric |
| INT | numeric | Numeric |
| SQR | numeric | Numeric |
| SGN | numeric | Numeric |
| ABS | numeric | Numeric |
| PEEK | numeric | Numeric |
| IN | numeric | Numeric |
| USR | numeric or string UDG-selection form | Numeric |
| STR$ | numeric | String |
| CHR$ | numeric | String |
| NOT | numeric | Numeric |
| BIN | lexical numeric prefix | Numeric |

This table is parser/semantic metadata, not yet the full runtime-domain validation catalogue.

## Operator typing

Working semantic rules:

- arithmetic operators operate on numeric expressions;
- comparisons produce numeric truth values;
- string comparisons are supported where the ROM permits them and must be verified per scanner type rules;
- `AND`, `OR`, `NOT` are numeric/logical operations with Spectrum semantics rather than a separate Boolean type;
- string concatenation with `+` must be represented if/where accepted by the ROM scanner.

ZXCode should not invent a Boolean type in the source-language semantic model.

## AST shape

Suggested expression nodes:

```text
NumericLiteral
StringLiteral
VariableReference
ArrayReference
StringSlice
BuiltinValue
BuiltinCall
UserFunctionCall
UnaryExpression
BinaryExpression
ParenthesizedExpression
ErrorExpression
```

Source spans should be retained on every node. String/REM preservation and future round-trip requirements make a lossless-enough syntax layer desirable even if the semantic AST is normalized.

## Parser / semantic separation

The parser should answer “what syntactic construct is this?” while semantic analysis answers “is this type/context valid?”

This matters for editor recovery. For example, partially typed code should still produce a useful syntax tree so completion can operate before the line is valid enough to build.

## Completion consequences

Expected-type information can filter suggestions:

- numeric context: numeric variables/functions/values;
- string context: string variables/functions/values;
- expression start: prefix functions, variables, literals, `(`, unary operators;
- argument lists: function-specific expected types;
- array/slice context: dimensions, comma, `TO`, closing parenthesis.

Completion should remain tolerant of incomplete syntax.

## Verification queue

- exact string comparison/concatenation typing;
- `USR` string form;
- complete variable-name lexical rules;
- exact array/subscript and string-slice grammar;
- user-defined function argument/name rules;
- domain/range warnings for built-ins.

## M2-04 verified typing contract

Sources: original Sinclair manual [chapter 9](https://worldofspectrum.org/ZXBasicManual/zxmanchap9.html)
(function signatures and string concatenation), [chapter 13](https://worldofspectrum.org/ZXBasicManual/zxmanchap13.html)
(comparisons and conditional expressions), [chapter 14](https://worldofspectrum.org/ZXBasicManual/zxmanchap14.html)
(USR string form), and the [ROM scanner](https://skoolkit.ca/disassemblies/rom/hex/asm/26C9.html)
at 0x273D..0x278E (type selection/checking).

- The analysis domain is numeric, string, unknown, error. There is no Boolean
  source type. Error/unknown operands suppress secondary type mismatches.
- `+` accepts two numbers or two strings and returns that type. Other arithmetic
  operators require numbers. Every comparison requires operands of the same type
  (two numbers or two strings) and returns numeric.
- AND requires a numeric right operand; its left operand may be numeric or string,
  and determines the result type. OR requires two numbers and returns numeric.
  NOT and unary minus require numeric operands. Unary plus is the ROM's no-op
  prefix and preserves either numeric or string type, rather than inventing a
  numeric-only check absent from S-U-PLUS.
- The function signature table above is authoritative for the supported parser
  forms: USR has one numeric-or-string argument and numeric result. Its string
  runtime form selects a UDG by one character (A..U/a..u or the UDG character).
  Runtime argument values/domain failures are not new static syntax restrictions.
- Name references get their value type from M2-03 identity; an undeclared numeric
  name still has numeric type. No declaration-before-use check is introduced.
- BIN's checked integer accumulator must not exceed 65535; empty digits mean zero
  and leading zeroes are unrestricted. Converted hidden storage is owned by the
  semantic node, just as decimal literal storage is.

### Shared typed model and build boundary

Standalone expression analysis and program analysis use the same semantic visitor
and signature table. Typed nodes retain ranges and validated literals/identities.
Malformed nodes and missing delimiters remain errors even if caller-supplied
parser diagnostics have been removed. Expected argument/result contexts report
semantic type errors, distinct from syntax or compatibility diagnostics.

To make accepted expression types buildable through the existing shared pipeline,
the expression encoder is extended alongside typing: it emits semantic nodes,
never reparses source or evaluates expressions. Operators use ROM tokens where
applicable and ASCII elsewhere. Parentheses and unary plus remain explicit.
Names emit canonical ASCII spelling; no lexer keyword annotations are consulted
inside names. BIN emits its token, normalized digit spelling and checked numeric
marker/storage. The independent expression-ROM input bytes provide byte fixtures
for every already researched operator/priority case; M1 golden images stay fixed.
Traversal uses explicit work stacks so long operator chains cannot exhaust the
host call stack. This does not add array/slice/FN or PRINT-control grammar.

The fixed `expression-types-rom.json` corpus records 114 syntax-mode observations
from the original scanner. Its standalone verifier runs without ZXCode code,
using numeric/string variable operands to avoid inserting decimal constants in
syntax mode. It covers each supported built-in signature and every operator's
numeric/string combinations, including unary plus on strings and string AND.
