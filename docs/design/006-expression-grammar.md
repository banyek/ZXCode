# ZX Spectrum 48K Expression Grammar v0.1

Status: M2-02 parser contract; function signatures and name binding remain separate work.

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
| `^` (Spectrum byte 0x5E, displayed as `↑`) | 10 | left |

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

- expression associativity verified below;
- enumerate all built-in functions and exact argument/result types;
- define variable-name grammar;
- define string slicing/subscript ambiguity;
- define array access;
- define FN invocation and DEF FN binding;
- specify numeric literal lexical forms and later their five-byte encoded representation.

## M2-02 verified scanner decisions

The [original ROM scanner](https://skoolkit.ca/disassemblies/rom/hex/asm/26C9.html)
at 0x2734..0x273A compares the stacked priority with the incoming priority and
waits only when the incoming priority is strictly greater. Equal priorities reduce
immediately: **all binary operators, including exponentiation, associate left**.
Thus `2^3^2` means `(2^3)^2`, not `2^(3^2)`.

Unary minus has priority 9 (0x26DF), NOT has priority 4 (0x26F2), and VAL$ plus
CODE..CHR$ have priority 16 (0x26E6 / 0x26FC). Unary plus at 0x25AF advances
to the next prefix without stacking an operation; the CST retains it as a wrapper
on that prefix, with no calculator operation. Therefore `-2^2` means `-(2^2)`,
`NOT 1=0` means `NOT (1=0)`, and `SIN 1^2` means `(SIN 1)^2`.
The [operator table](https://skoolkit.ca/disassemblies/rom/hex/asm/2795.html)
uses byte 0x5E for exponentiation; the text spelling in this implementation is `^`.
No Unicode-arrow alias is introduced by this issue.

The recoverable expression CST supports decimal/string/BIN literals, unbound
name references (original spelling only), RND/PI/INKEY$ values, parenthesized
expressions, unary operators, binary operators, ordinary single-operand prefix
functions, and the dedicated parenthesized two-operand POINT/ATTR/SCREEN$ forms.
FN binding/call grammar and array/slice postfix grammar remain their dedicated
M2 issues; they are not guessed here. Variable identity is likewise deferred to
M2-03. Comparisons `<=`, `>=`, `<>` are contiguous punctuation tokens outside
strings/REM; they are never synthesized across whitespace.

PRINT uses this same parser for its expression slots. M2-02 initially guarded
nonliteral nodes with compatibility diagnostics; M2-04 replaces that temporary
guard with shared semantic typing and expression encoding.
Parser success alone is not semantic acceptance. Existing literal builds retain
their exact byte output. Error expressions and missing delimiters retain ranges
and stop at item, statement and physical-line boundaries. A nesting budget of
256 protects editor input from exhausting the host stack and reports a tooling
limit rather than silently truncating source.

`tests/fixtures/expression-rom.json` records original-ROM operation traces for
priority boundaries, associativity and unary/function cases. Its standalone
verifier executes SCANNING at 0x24FB, recording calculator operation offsets at
0x2753; no ZXCode parser or encoder participates in producing observations.

### BIN lexical boundary

The [ROM converter](https://skoolkit.ca/disassemblies/rom/hex/asm/2C9B.html)
initializes BIN's accumulator to zero, consumes zero or more binary digits using
GET-CHAR/NEXT-CHAR (which skip spaces), and stops at the first other character.
Consequently bare `BIN` is zero, `BIN 1 0` is two, and leading zeroes do not impose
a fixed digit-count limit. The CST retains normalized digit spelling plus the
original digit range; overflow beyond 65535 belongs to semantic validation.
Independent DEC-TO-FP cases in the same fixture verify these boundaries. The
verifier runs these at 0x2C9B rather than the executing scanner's cached-number path.
