# ZX Spectrum 48K Expression Grammar v0.1

Status: ROM-derived operator baseline; function signatures still being expanded.

## Binary operators and precedence

The ROM scanner has an explicit operator table and priority table. Higher numeric priority binds more tightly.

| Operator | ROM priority | Working associativity |
|---|---:|---|
| `OR` | 2 | left |
| `AND` | 3 | left |
| `<=` | 5 | left |
| `>=` | 5 | left |
| `<>` | 5 | left |
| `>` | 5 | left |
| `<` | 5 | left |
| `=` | 5 | left |
| `+` | 6 | left |
| `-` | 6 | left |
| `*` | 8 | left |
| `/` | 8 | left |
| `↑` / exponentiation | 10 | verify associativity against scanner behaviour |

Do not infer precedence from another BASIC implementation; use these ROM priorities.

## Expression-start scanning

The ROM scanning-function table explicitly recognizes expression starts including:

- quoted string;
- parenthesized expression;
- decimal/numeric literal;
- unary plus;
- `FN`;
- `RND`;
- `PI`;
- `INKEY$`;
- `BIN` numeric form;
- `SCREEN$`;
- `ATTR`;
- `POINT`.

Other named functions are reached through the ROM's letter/function scanning path and must be catalogued with their type/signature.

## Unary operators

At minimum the parser must model unary `+`, unary `-`, and `NOT` separately from their binary/token roles. Exact precedence/type behaviour will be verified from the scanner/calculator routines.

## Types

Spectrum BASIC expressions are not simply an untyped syntax tree. ZXCode needs enough type information to:

- distinguish numeric and string expressions;
- validate statement/function argument positions;
- understand string variables/arrays/slices;
- offer context-aware completion;
- diagnose impossible type combinations without inventing stricter rules than the ROM.

Proposed expression type domain:

```text
Numeric
String
Unknown/Error
```

Variable/array/function metadata carries shape information separately.

## Parser strategy

A Pratt parser or precedence-climbing parser maps naturally to the ROM priority table, provided Spectrum-specific lexical and type rules remain explicit.

Conceptually:

```text
parseExpression(minPriority)
  parsePrefixOrPrimary()
  while next operator priority >= threshold
    consume operator
    parse rhs according to ROM precedence/associativity
```

This is an implementation direction, not yet a frozen algorithm.

## Line-reference semantics

GO TO and GO SUB accept numeric expressions, not a special line-number grammar. Therefore:

```basic
10 GO TO 100
20 GO TO X
30 GO TO 50+50
```

are all expression-shaped syntax. Only the first is trivially a static line reference; constant folding may later recognize the third, but navigation must not redefine syntax.

## Next work

- verify exponentiation associativity;
- enumerate all built-in functions and exact argument/result types;
- define variable-name grammar;
- define string slicing/subscript ambiguity;
- define array access;
- define FN invocation and DEF FN binding;
- specify numeric literal lexical forms and later their five-byte encoded representation.
