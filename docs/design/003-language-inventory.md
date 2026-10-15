# ZX Spectrum 48K BASIC Language Inventory v0.1

Status: research scaffold. Exact token bytes and grammar facts must be verified against primary/reference sources before becoming implementation contracts.

## Purpose

This inventory will become the shared source of truth for:

- lexer/parser metadata;
- encoder token IDs;
- syntax highlighting;
- hover documentation;
- completion and Tab completion;
- statement/function signatures;
- compatibility diagnostics.

It should describe the original ZX Spectrum 48K BASIC language rather than a modern dialect.

## Inventory model

Each language item should eventually record, where applicable:

- spelling;
- category: statement, function, operator, modifier, special token;
- ROM token byte;
- syntactic contexts;
- argument/signature shape;
- expression return type;
- precedence/associativity for operators;
- special lexical/parsing rules;
- completion contexts;
- short documentation;
- source references;
- verification status.

Complex grammar must not be forced into declarative metadata merely for convenience.

## Initial categories

### Statements

Inventory to verify includes constructs such as:

`BEEP`, `BORDER`, `BRIGHT`, `CAT`, `CIRCLE`, `CLEAR`, `CLOSE #`, `CLS`, `CONTINUE`, `COPY`, `DATA`, `DEF FN`, `DIM`, `DRAW`, `ERASE`, `FLASH`, `FOR`, `FORMAT`, `GO SUB`, `GO TO`, `IF`, `INK`, `INPUT`, `INVERSE`, `LET`, `LIST`, `LLIST`, `LOAD`, `LPRINT`, `MERGE`, `MOVE`, `NEW`, `NEXT`, `OPEN #`, `OUT`, `OVER`, `PAPER`, `PAUSE`, `PLOT`, `POKE`, `PRINT`, `RANDOMIZE`, `READ`, `REM`, `RESTORE`, `RETURN`, `RUN`, `SAVE`, `STOP`, `VERIFY`.

This list is intentionally marked for verification; category boundaries and availability on the exact 48K ROM target must be checked rather than assumed from later Spectrum-family references.

### Functions and expression forms

Inventory to verify includes numeric/string functions and forms such as:

`ABS`, `ACS`, `ASN`, `ATN`, `ATTR`, `CHR$`, `CODE`, `COS`, `EXP`, `FN`, `IN`, `INKEY$`, `INT`, `LEN`, `LN`, `PEEK`, `PI`, `POINT`, `RND`, `SCREEN$`, `SGN`, `SIN`, `SQR`, `STR$`, `TAN`, `USR`, `VAL`, `VAL$`.

### Operators

The inventory must capture arithmetic, comparison and logical operators with authentic Spectrum precedence and typing rules, including textual operators such as `AND`, `OR`, and `NOT`.

### PRINT/INPUT formatting and channel-related forms

Items such as `AT`, `TAB`, colour/control modifiers, separators, and channel syntax need contextual modelling rather than global keyword substitution.

## Completion metadata

Completion is an IDE feature and must not modify the language.

Examples:

```basic
10 PRI|
```

may complete to:

```basic
10 PRINT |
```

After a line-reference context:

```basic
100 GO TO |
```

the language service may offer existing program line numbers, ideally with a preview of the target line.

Completion after statements such as PRINT should be context-aware and only offer constructs legal or meaningful in that grammar position.

Snippets may insert authentic BASIC templates while keeping the resulting source valid Spectrum BASIC.

## Important lexical/parser cases

### REM

Keyword-looking text inside REM must not be blindly tokenized. REM requires explicit handling and preservation.

### Strings

Keyword recognition inside quoted strings must follow authentic Spectrum storage/entry semantics rather than a global textual replacement algorithm.

### Numeric literals

Spectrum BASIC stores numeric information using ROM-specific encoding. The encoder must model this explicitly.

### Context-sensitive keywords

A lexer cannot safely replace every textual occurrence of a keyword with its token. Existing Spectrum tokenizers demonstrate context-dependent cases; the parser and encoder must share enough information to make the correct decision.

## Verification work

Before implementation, complete a table of every 48K token with exact byte, spelling, category and grammar role, then reconcile it against the ROM syntax tables and original manual.

Independent tools should be used to generate comparison fixtures, especially for unusual lexical cases, numbers, strings, REM, graphics/control codes, and SAVE/LOAD forms.
