# Parser and Language Service Architecture v0.1

Status: design proposal derived from the ROM grammar work.

## Goal

One language implementation must power build correctness and IDE intelligence. ZXCode must not have a permissive editor parser and a separate incompatible tokenizer.

## Layers

```text
UTF-8 source
    |
Source lexer
    |
Recoverable concrete syntax tree (CST)
    |
Semantic AST / symbols / types
   / | \
  /  |  \
diagnostics  completion/navigation  encoder
                                  |
                         tokenized BASIC bytes
                                  |
                              TAP writer
```

## Why a recoverable CST

An IDE constantly sees invalid and half-written source:

```basic
10 PRINT AT 10,
20 GO TO
30 FOR I=1 TO
```

Completion and diagnostics must work there. A build-only parser that aborts on the first syntax error is insufficient.

The CST should retain:

- exact source spans;
- whitespace/trivia where useful;
- original keyword spelling/case;
- string literal text;
- raw REM tail;
- incomplete/error nodes.

The semantic AST may normalize these into Spectrum-language concepts.

## Lexer modes

The lexer cannot be a global keyword replacer. At minimum it needs context/modes for:

- normal BASIC source;
- quoted strings;
- REM raw tail;
- textual Spectrum escape sequences once their syntax is finalized.

DATA may also require parser-aware handling depending on the exact ROM lexical behaviour established by fixtures.

## Parser

A hybrid approach fits the language:

- statement dispatcher keyed by authentic command vocabulary;
- dedicated parsers for structurally special commands;
- ROM command-class helpers for repeated operand patterns;
- precedence-climbing/Pratt-style expression parser driven by ROM operator priorities;
- error recovery at statement separators and physical line boundaries.

## Semantic model

Semantic analysis builds:

- program line-number index;
- variables and array symbols;
- DEF FN definitions;
- expression result types;
- literal line-reference decorations;
- capability requirements;
- diagnostics not intrinsic to parsing.

## Line numbers

Line numbers are part of the authentic source model and also form the primary navigation namespace.

Suggested index:

```text
ProgramLines {
  byNumber: Map<number, BasicLine>
  ordered: BasicLine[]
}
```

Duplicate line numbers are build errors.

A numeric expression following GO TO is not intrinsically a line-reference AST node. When the expression is a literal (and potentially later when it constant-folds), semantic analysis may attach a `LineTarget` relation for Go to Definition, references and warnings.

## Language service

The language service consumes CST + semantic model.

Capabilities:

- diagnostics;
- hover documentation;
- completion;
- signature/context help where useful;
- definition navigation;
- references;
- document symbols;
- later rename/renumber refactoring.

### Completion contract

Completion queries parser state at the cursor.

Examples:

```text
statement-start -> valid command vocabulary
PRINT item       -> expressions, AT, TAB, colour controls...
GO TO expr-start -> numeric expression + ranked existing line numbers
FOR ... end      -> STEP
IF condition end -> THEN
string context   -> string-producing symbols/functions
```

Tab is simply the editor acceptance gesture for a completion item; the language service itself exposes completion candidates independent of VS Code keybindings.

## Encoder boundary

The encoder accepts only a semantically buildable program. It must not re-parse raw text independently.

```text
parse -> analyze -> BuildableProgram -> encode
```

This prevents “linter says yes, TAP builder says no” drift.

## Test strategy implied by architecture

Three complementary fixture families:

1. **language fixtures** — source -> CST/AST/diagnostics;
2. **binary fixtures** — accepted source -> exact tokenized BASIC bytes/TAP;
3. **editor fixtures** — incomplete source + cursor -> completion/navigation result.

Binary expected values should come from independently validated Spectrum tooling/ROM behaviour wherever possible.
