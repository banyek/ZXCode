# ZX Spectrum 48K ROM Token Catalogue v0.1

Status: byte mapping verified against the original ROM token table as documented by The Complete Spectrum ROM Disassembly. Grammar/category labels are provisional where noted.

## Important distinction

The 48K ROM contains a continuous token vocabulary from `0xA5` through `0xFF`: 91 token values.

Some vocabulary is present in the ROM even though useful execution depends on additional hardware/ROM support. In particular `CAT`, `FORMAT`, `MOVE`, `ERASE`, `OPEN #`, and `CLOSE #` are present in the base ROM token and syntax tables. ZXCode therefore must not treat them as unknown lexical items. Instead, diagnostics should distinguish **ROM vocabulary** from **runtime capability/profile**.

This suggests two separate questions:

1. Can the original 48K ROM represent and parse this token?
2. Can the selected target machine/profile execute it meaningfully with the required peripheral/extension present?

For the default bare-48K profile, ZXCode can recognize these tokens while warning/erroring according to the eventual capability policy.

## Token table

| Byte | Token | Working category | Verification |
|---:|---|---|---|
| `0xA5` | `RND` | function/value | verified from ROM token table |
| `0xA6` | `INKEY$` | function/value | verified from ROM token table |
| `0xA7` | `PI` | function/value | verified from ROM token table |
| `0xA8` | `FN` | function/operator | verified from ROM token table |
| `0xA9` | `POINT` | function/operator | verified from ROM token table |
| `0xAA` | `SCREEN$` | function/operator | verified from ROM token table |
| `0xAB` | `ATTR` | function/operator | verified from ROM token table |
| `0xAC` | `AT` | function/operator | verified from ROM token table |
| `0xAD` | `TAB` | function/operator | verified from ROM token table |
| `0xAE` | `VAL$` | function/operator | verified from ROM token table |
| `0xAF` | `CODE` | function/operator | verified from ROM token table |
| `0xB0` | `VAL` | function/operator | verified from ROM token table |
| `0xB1` | `LEN` | function/operator | verified from ROM token table |
| `0xB2` | `SIN` | function/operator | verified from ROM token table |
| `0xB3` | `COS` | function/operator | verified from ROM token table |
| `0xB4` | `TAN` | function/operator | verified from ROM token table |
| `0xB5` | `ASN` | function/operator | verified from ROM token table |
| `0xB6` | `ACS` | function/operator | verified from ROM token table |
| `0xB7` | `ATN` | function/operator | verified from ROM token table |
| `0xB8` | `LN` | function/operator | verified from ROM token table |
| `0xB9` | `EXP` | function/operator | verified from ROM token table |
| `0xBA` | `INT` | function/operator | verified from ROM token table |
| `0xBB` | `SQR` | function/operator | verified from ROM token table |
| `0xBC` | `SGN` | function/operator | verified from ROM token table |
| `0xBD` | `ABS` | function/operator | verified from ROM token table |
| `0xBE` | `PEEK` | function/operator | verified from ROM token table |
| `0xBF` | `IN` | function/operator | verified from ROM token table |
| `0xC0` | `USR` | function/operator | verified from ROM token table |
| `0xC1` | `STR$` | function/operator | verified from ROM token table |
| `0xC2` | `CHR$` | function/operator | verified from ROM token table |
| `0xC3` | `NOT` | function/operator | verified from ROM token table |
| `0xC4` | `BIN` | function/operator | verified from ROM token table |
| `0xC5` | `OR` | function/operator | verified from ROM token table |
| `0xC6` | `AND` | operator/syntax | verified from ROM token table |
| `0xC7` | `<=` | operator/syntax | verified from ROM token table |
| `0xC8` | `>=` | operator/syntax | verified from ROM token table |
| `0xC9` | `<>` | operator/syntax | verified from ROM token table |
| `0xCA` | `LINE` | operator/syntax | verified from ROM token table |
| `0xCB` | `THEN` | operator/syntax | verified from ROM token table |
| `0xCC` | `TO` | operator/syntax | verified from ROM token table |
| `0xCD` | `STEP` | operator/syntax | verified from ROM token table |
| `0xCE` | `DEF FN` | Interface 1 vocabulary | verified from ROM token table |
| `0xCF` | `CAT` | Interface 1 vocabulary | verified from ROM token table |
| `0xD0` | `FORMAT` | Interface 1 vocabulary | verified from ROM token table |
| `0xD1` | `MOVE` | Interface 1 vocabulary | verified from ROM token table |
| `0xD2` | `ERASE` | Interface 1 vocabulary | verified from ROM token table |
| `0xD3` | `OPEN #` | Interface 1 vocabulary | verified from ROM token table |
| `0xD4` | `CLOSE #` | Interface 1 vocabulary | verified from ROM token table |
| `0xD5` | `MERGE` | statement/modifier | verified from ROM token table |
| `0xD6` | `VERIFY` | statement/modifier | verified from ROM token table |
| `0xD7` | `BEEP` | statement/modifier | verified from ROM token table |
| `0xD8` | `CIRCLE` | statement/modifier | verified from ROM token table |
| `0xD9` | `INK` | statement/modifier | verified from ROM token table |
| `0xDA` | `PAPER` | statement/modifier | verified from ROM token table |
| `0xDB` | `FLASH` | statement/modifier | verified from ROM token table |
| `0xDC` | `BRIGHT` | statement/modifier | verified from ROM token table |
| `0xDD` | `INVERSE` | statement/modifier | verified from ROM token table |
| `0xDE` | `OVER` | statement/modifier | verified from ROM token table |
| `0xDF` | `OUT` | statement/modifier | verified from ROM token table |
| `0xE0` | `LPRINT` | statement/modifier | verified from ROM token table |
| `0xE1` | `LLIST` | statement/modifier | verified from ROM token table |
| `0xE2` | `STOP` | statement/modifier | verified from ROM token table |
| `0xE3` | `READ` | statement/modifier | verified from ROM token table |
| `0xE4` | `DATA` | statement/modifier | verified from ROM token table |
| `0xE5` | `RESTORE` | statement/modifier | verified from ROM token table |
| `0xE6` | `NEW` | statement/modifier | verified from ROM token table |
| `0xE7` | `BORDER` | statement/modifier | verified from ROM token table |
| `0xE8` | `CONTINUE` | statement/modifier | verified from ROM token table |
| `0xE9` | `DIM` | statement/modifier | verified from ROM token table |
| `0xEA` | `REM` | statement/modifier | verified from ROM token table |
| `0xEB` | `FOR` | statement/modifier | verified from ROM token table |
| `0xEC` | `GO TO` | statement/modifier | verified from ROM token table |
| `0xED` | `GO SUB` | statement/modifier | verified from ROM token table |
| `0xEE` | `INPUT` | statement/modifier | verified from ROM token table |
| `0xEF` | `LOAD` | statement/modifier | verified from ROM token table |
| `0xF0` | `LIST` | statement/modifier | verified from ROM token table |
| `0xF1` | `LET` | statement/modifier | verified from ROM token table |
| `0xF2` | `PAUSE` | statement/modifier | verified from ROM token table |
| `0xF3` | `NEXT` | statement/modifier | verified from ROM token table |
| `0xF4` | `POKE` | statement/modifier | verified from ROM token table |
| `0xF5` | `PRINT` | statement/modifier | verified from ROM token table |
| `0xF6` | `PLOT` | statement/modifier | verified from ROM token table |
| `0xF7` | `RUN` | statement/modifier | verified from ROM token table |
| `0xF8` | `SAVE` | statement/modifier | verified from ROM token table |
| `0xF9` | `RANDOMIZE` | statement/modifier | verified from ROM token table |
| `0xFA` | `IF` | statement/modifier | verified from ROM token table |
| `0xFB` | `CLS` | statement/modifier | verified from ROM token table |
| `0xFC` | `DRAW` | statement/modifier | verified from ROM token table |
| `0xFD` | `CLEAR` | statement/modifier | verified from ROM token table |
| `0xFE` | `RETURN` | statement/modifier | verified from ROM token table |
| `0xFF` | `COPY` | statement/modifier | verified from ROM token table |

## Grammar facts established from ROM syntax tables

The ROM contains syntax entries for fifty BASIC commands. Its command-class machinery explicitly distinguishes, among other forms:

- no further operands;
- LET variable + expression;
- optional numeric expression;
- single-character variable;
- item lists;
- required numeric expression;
- colour items;
- two comma-separated numeric expressions;
- graphics commands that also allow colour items;
- required string expression;
- cassette command syntax.

This is valuable for ZXCode because it gives us an independent skeleton for statement parsing rather than deriving grammar from examples.

## Consequences for the parser

### Token byte != grammar category

The byte table is lexical truth, not a sufficient parser specification. `AT`, `TAB`, `THEN`, `TO`, `STEP`, colour items and expression functions have contextual roles.

### Capability profiles

Proposed model:

```text
spectrum48
  ROM vocabulary: full 0xA5..0xFF token set
  runtime capabilities:
    cassette
    screen
    beeper
    ZX printer semantics where applicable

spectrum48+if1   (future profile)
  inherits spectrum48
  adds Interface 1 / Microdrive execution capabilities
```

The exact diagnostic severity for a ROM-recognized but unavailable capability remains a design decision.

### Completion

Completion should use grammar position plus capability profile. It may know that a token exists without suggesting it by default when the active profile cannot use it.

## Next verification work

1. Map the fifty command tokens to their ROM syntax-table forms.
2. Build the expression/operator precedence table from the ROM calculator/scanning tables.
3. Specify variable names, arrays, slicing, strings and numeric lexical forms.
4. Specify exact handling of REM, DATA and quoted strings.
5. Define textual representation for Spectrum character/control codes.
6. Cross-check generated token streams against an independent tokenizer.
