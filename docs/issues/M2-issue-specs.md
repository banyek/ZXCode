# M2 — Authentic BASIC Core: Issue Specifications

## M2-01 — Implement complete 48K ROM token catalogue
**Readiness:** dev-ready
**Dependencies:** M1

Build the shared token vocabulary for bytes 0xA5..0xFF with canonical spelling/category and parser/encoder metadata.

**Acceptance criteria:** all 91 token values represented exactly once; byte/spelling lookup both tested; catalogue is shared rather than duplicated by lexer/encoder.

## M2-02 — Implement ROM-precedence expression parser
**Readiness:** dev-ready
**Dependencies:** M2-01

Implement numeric/string primaries, prefix functions, unary/binary operators and ROM precedence/associativity.

**Acceptance criteria:** precedence fixtures cover every priority boundary; malformed/incomplete expressions recover; parser preserves ranges; unresolved associativity questions are researched rather than guessed.

## M2-03 — Research and implement Spectrum variable/symbol identity
**Readiness:** research-required
**Dependencies:** M2-02

Freeze authentic numeric/string variable naming, canonicalization and symbol categories.

**Acceptance criteria:** manual/ROM-derived naming rules documented; canonical identity + original spelling retained; fixtures cover unusual legal/illegal names.

## M2-04 — Implement expression typing and built-in signatures
**Readiness:** dev-ready after M2-03
**Dependencies:** M2-02, M2-03

Numeric/String/Unknown/Error typing, built-in argument/result signatures, comparison/logical numeric results.

**Acceptance criteria:** no synthetic Boolean type; wrong argument/result contexts diagnose; function signatures match documented 48K behaviour.

## M2-05 — Implement simple ROM command-class statements
**Readiness:** dev-ready
**Dependencies:** M2-02

Implement the straightforward no-operand, numeric, pair, colour/control and string-expression command shapes using reusable grammar helpers.

**Acceptance criteria:** each supported ROM command has parser + encoder fixture; helpers do not flatten special grammars into generic argument lists.

## M2-06 — Implement LET and assignable targets
**Readiness:** dev-ready after M2-03
**Dependencies:** M2-03, M2-04

**Acceptance criteria:** numeric/string scalar assignment works; invalid expression-as-target diagnoses; target type checked; architecture permits array/slice targets added later.

## M2-07 — Implement control flow and static line-target semantics
**Readiness:** dev-ready
**Dependencies:** M2-02

GO TO, GO SUB, RETURN, IF/THEN statement tails and colon-separated statement sequences.

**Acceptance criteria:** numeric-expression targets remain expressions; literal targets receive semantic line-reference relation; missing literal target is warning; IF tail supports multiple statements/recovery.

## M2-08 — Implement FOR/NEXT
**Readiness:** dev-ready
**Dependencies:** M2-03, M2-04

**Acceptance criteria:** authentic FOR variable/range/optional STEP grammar; NEXT variable validation; typing fixtures; no modern loop syntax.

## M2-09 — Research and implement PRINT/LPRINT item grammar
**Readiness:** research-required
**Dependencies:** M2-04

**Acceptance criteria:** expression items, separators, AT/TAB and formatting controls represented semantically; empty/trailing item cases fixture-tested; LPRINT differences documented; not modeled as generic call arguments.

## M2-10 — Research and implement INPUT grammar
**Readiness:** research-required
**Dependencies:** M2-06, M2-09

**Acceptance criteria:** prompts/display items separated from assignable input targets; LINE form supported per ROM; malformed target diagnosed; fixtures derive from authentic syntax.

## M2-11 — Implement arrays, DIM and string slicing
**Readiness:** research-required
**Dependencies:** M2-03, M2-06

**Acceptance criteria:** numeric/string arrays, multidimensional subscripts and DIM supported; TO slicing is contextual syntax not binary operator; open slice bounds tested; exact assignability rules researched/covered.

## M2-12 — Research and implement DATA/READ/RESTORE
**Readiness:** research-required
**Dependencies:** M2-06

**Acceptance criteria:** DATA grammar based on ROM behaviour; READ targets validated; RESTORE optional target semantics correct; DATA preservation sufficient for exact encoding.

## M2-13 — Research and implement DEF FN and FN calls
**Readiness:** research-required
**Dependencies:** M2-03, M2-04

**Acceptance criteria:** authentic name/formal rules; numeric/string result identity; calls link to definitions where resolvable; parameter/body typing diagnosed.

## M2-14 — Implement REM raw-tail semantics
**Readiness:** research-required
**Dependencies:** M2-01

**Acceptance criteria:** keyword-like content after REM is not parsed/tokenized normally; raw source range preserved; colon/quote edge cases match ROM fixtures; arbitrary-byte policy deferred to M3 where necessary.

## M2-15 — Implement LIST/LLIST and cassette command grammars
**Readiness:** research-required
**Dependencies:** M2-02, M2-04

**Acceptance criteria:** LIST/LLIST accepted forms fixture-driven; SAVE/LOAD/VERIFY/MERGE cassette grammar represented explicitly; no generic-expression-list shortcut.

## M2-16 — Define capability policy for ROM-recognized peripheral commands
**Readiness:** design-required
**Dependencies:** M2-01

CAT/FORMAT/MOVE/ERASE/OPEN#/CLOSE# remain part of ROM vocabulary while target profile determines execution capability.

**Acceptance criteria:** parser recognizes authentic forms; diagnostic severity/profile policy documented; default completion policy specified; vocabulary is not falsely labelled “non-48K token”.

## M2-17 — Complete encoder coverage and BASIC-core acceptance corpus
**Readiness:** blocked
**Dependencies:** M2-05..M2-16

Extend encoder for all M2 constructs and create representative programs covering language combinations.

**Acceptance criteria:** every accepted M2 AST construct has encoding tests; corpus covers graphics, strings, math, input, arrays, DATA, control flow and functions; unsupported syntax fails structurally; no placeholder encoding.
