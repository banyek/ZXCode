# ZX Spectrum 48K Expression Semantics v0.2

Status: parser-facing research notes.

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
| USR | numeric or string form; exact semantics to document | Numeric |
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
