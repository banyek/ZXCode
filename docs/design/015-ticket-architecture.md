# ZXCode Ticket Architecture v0.1

Status: planned backlog before GitHub issue creation.

## Conventions

Readiness:
- **dev-ready** — sufficiently specified for implementation.
- **research-required** — historical/runtime facts must be established first.
- **design-required** — product/API decision is still open.
- **blocked** — prerequisite implementation is missing.

Waves are implementation ordering groups. A ticket may depend on earlier waves in the same milestone or on prior milestones.

---

# M1 — Hello Spectrum

## M1-W0 Foundation

### M1-01 — Establish repository implementation skeleton
**Readiness:** dev-ready  
**Depends on:** none

Create the initial package/module layout for source model, parser, semantic analysis, encoder, TAP, CLI and tests. Keep VS Code absent from core dependencies.

**DoD:** test runner and CLI entry point execute; package boundaries reflect design docs; CI-ready commands documented.

### M1-02 — Define core source ranges and structured diagnostics
**Readiness:** dev-ready  
**Depends on:** M1-01

Implement offset/range/location primitives and diagnostic data structures with stable code/category/severity/message/range fields.

**DoD:** parser/semantic code can return structured diagnostics without UI dependencies.

### M1-03 — Define encoded-program and source-map result contracts
**Readiness:** dev-ready  
**Depends on:** M1-01, M1-02

Define build artifact layers and source-to-encoded mapping contracts needed by future refactoring/debugging.

**DoD:** interfaces exist for BuildableProgram, encoded BASIC image and source mapping without implementing all grammar.

## M1-W1 Minimal language path

### M1-04 — Parse physical BASIC lines and line numbers
**Readiness:** dev-ready  
**Depends on:** M1-02

Support UTF-8 source splitting, explicit line numbers, ranges, duplicate detection and minimal line structure.

### M1-05 — Implement recoverable lexer/CST for hello subset
**Readiness:** dev-ready  
**Depends on:** M1-04

Recognize the minimal tokens, strings, separators and numeric literals needed by the hello fixture while preserving source spans and incomplete/error nodes.

### M1-06 — Implement minimal statement/expression parser
**Readiness:** dev-ready  
**Depends on:** M1-05

Parse the chosen hello program through the same architectural path later used by full BASIC.

### M1-07 — Implement minimal semantic/build validation
**Readiness:** dev-ready  
**Depends on:** M1-06

Produce BuildableProgram or structured diagnostics. No encoder reparsing.

## M1-W2 Authentic binary output

### M1-08 — Implement Spectrum numeric encoder
**Readiness:** research-required  
**Depends on:** M1-01

Implement authentic numeric literal representation required by BASIC program lines; establish independent fixtures.

### M1-09 — Implement BASIC token/line encoder
**Readiness:** dev-ready after M1-08  
**Depends on:** M1-03, M1-07, M1-08

Encode supported AST into authentic tokenized BASIC line/program bytes and source mapping.

### M1-10 — Implement TAP writer
**Readiness:** dev-ready  
**Depends on:** M1-01

Implement Spectrum TAP block length, header/data blocks, flags/checksum and BASIC metadata needed by M1.

### M1-11 — Add CLI check/build commands
**Readiness:** dev-ready  
**Depends on:** M1-07, M1-09, M1-10

`zxcode check` and `zxcode build` use shared core APIs.

## M1-W3 Proof

### M1-12 — Establish independent hello golden fixture
**Readiness:** research-required  
**Depends on:** M1-08, M1-10

Generate/verify expected BASIC/TAP bytes independently from ZXCode.

### M1-13 — Add reference-emulator smoke test procedure
**Readiness:** design-required  
**Depends on:** M1-11

Choose the first reference emulator and document/reproduce loading/running the generated TAP.

### M1-14 — M1 end-to-end acceptance test
**Readiness:** blocked  
**Depends on:** M1-11, M1-12, M1-13

`examples/hello.bas` deterministically builds, binary matches fixture, loads and prints HELLO WORLD.

---

# M2 — Authentic BASIC Core

## M2-W0 Grammar infrastructure

### M2-01 — Implement full ROM token catalogue
**Readiness:** dev-ready
**Depends on:** M1

Shared metadata for token byte/spelling/category/documentation.

### M2-02 — Implement ROM-precedence expression parser
**Readiness:** dev-ready
**Depends on:** M2-01

Numeric/string primary expressions, unary/binary operations and authentic precedence.

### M2-03 — Implement Spectrum variable identity and symbol model
**Readiness:** research-required
**Depends on:** M2-02

Freeze authentic naming/canonicalization rules and represent scalar/string/array identities.

### M2-04 — Implement typed expression semantic analysis
**Readiness:** dev-ready after M2-03
**Depends on:** M2-02, M2-03

Numeric/string result typing and function argument validation without a synthetic Boolean type.

## M2-W1 Statements

### M2-05 — Implement simple ROM command-class statements
**Readiness:** dev-ready
**Depends on:** M2-02

Statements directly expressible through command classes 00/03/04/06/07/08/09/0A.

### M2-06 — Implement LET and assignable targets
**Readiness:** dev-ready after M2-03
**Depends on:** M2-03, M2-04

### M2-07 — Implement GO TO / GO SUB / RETURN and line-target semantics
**Readiness:** dev-ready
**Depends on:** M2-02

### M2-08 — Implement IF/THEN and statement sequences
**Readiness:** dev-ready
**Depends on:** M2-05, M2-07

### M2-09 — Implement FOR/NEXT
**Readiness:** dev-ready
**Depends on:** M2-03, M2-04

### M2-10 — Implement PRINT/LPRINT grammar
**Readiness:** research-required
**Depends on:** M2-04

### M2-11 — Implement INPUT grammar
**Readiness:** research-required
**Depends on:** M2-06, M2-10

### M2-12 — Implement DIM and array access
**Readiness:** research-required
**Depends on:** M2-03, M2-06

### M2-13 — Implement string slicing
**Readiness:** research-required
**Depends on:** M2-12

### M2-14 — Implement DATA/READ/RESTORE
**Readiness:** research-required
**Depends on:** M2-06

### M2-15 — Implement DEF FN and user function calls
**Readiness:** research-required
**Depends on:** M2-03, M2-04

### M2-16 — Implement REM raw-tail syntax
**Readiness:** research-required
**Depends on:** M2-01

### M2-17 — Implement LIST/LLIST grammar
**Readiness:** research-required
**Depends on:** M2-02

### M2-18 — Implement SAVE/LOAD/VERIFY/MERGE cassette grammar
**Readiness:** research-required
**Depends on:** M2-04

### M2-19 — Implement ROM-recognized capability-tagged commands
**Readiness:** design-required
**Depends on:** M2-01

CAT/FORMAT/MOVE/ERASE/OPEN#/CLOSE# remain recognized while capability policy is explicit.

## M2-W2 Complete encoding

### M2-20 — Extend encoder to complete supported grammar
**Readiness:** blocked
**Depends on:** M2-05..M2-19

### M2-21 — Build representative BASIC corpus
**Readiness:** dev-ready incrementally
**Depends on:** M2 statement tickets

### M2-22 — M2 language-core acceptance suite
**Readiness:** blocked
**Depends on:** M2-20, M2-21

---

# M3 — Spectrum Fidelity

### M3-01 — Freeze exact numeric literal/storage behaviour
**Readiness:** research-required
**Depends on:** M2

### M3-02 — Build complete Spectrum character map
**Readiness:** research-required
**Depends on:** M2

### M3-03 — Specify and implement control-code encoding
**Readiness:** research-required
**Depends on:** M3-02

### M3-04 — Specify and implement block graphics representation
**Readiness:** design-required
**Depends on:** M3-02

### M3-05 — Specify and implement UDG source representation
**Readiness:** design-required
**Depends on:** M3-02

### M3-06 — Freeze ZXCode textual escape syntax
**Readiness:** design-required
**Depends on:** M3-03, M3-04, M3-05

### M3-07 — Harden REM/string/keyword lexical edge cases
**Readiness:** research-required
**Depends on:** M3-06

### M3-08 — Harden TAP metadata/autostart/container edge cases
**Readiness:** research-required
**Depends on:** M2

### M3-09 — Implement TAP decoder/import research spike
**Readiness:** research-required
**Depends on:** M3-02, M3-03

### M3-10 — Create independent compatibility corpus
**Readiness:** research-required
**Depends on:** M3-01..M3-09

### M3-11 — Cross-platform deterministic binary tests
**Readiness:** dev-ready
**Depends on:** M3-10

### M3-12 — M3 fidelity acceptance suite
**Readiness:** blocked
**Depends on:** M3-10, M3-11

---

# M4 — Language Intelligence

### M4-01 — Define editor-independent language-service API
**Readiness:** dev-ready
**Depends on:** M3

### M4-02 — Implement document analysis/session model
**Readiness:** design-required
**Depends on:** M4-01

### M4-03 — Expose structured diagnostics
**Readiness:** dev-ready
**Depends on:** M4-02

### M4-04 — Implement symbol index
**Readiness:** dev-ready
**Depends on:** M4-02

### M4-05 — Implement hover information
**Readiness:** dev-ready
**Depends on:** M4-04

### M4-06 — Implement definition navigation
**Readiness:** dev-ready
**Depends on:** M4-04

### M4-07 — Implement references
**Readiness:** dev-ready
**Depends on:** M4-04

### M4-08 — Implement parser-state completion engine
**Readiness:** design-required
**Depends on:** M4-02, M4-04

### M4-09 — Implement semantic line-number completion
**Readiness:** dev-ready
**Depends on:** M4-08

### M4-10 — Add documentation/signature metadata
**Readiness:** research-required
**Depends on:** M4-01

### M4-11 — Implement document symbols
**Readiness:** dev-ready
**Depends on:** M4-04

### M4-12 — Build incomplete-source editor fixture suite
**Readiness:** dev-ready
**Depends on:** M4-03, M4-08

### M4-13 — M4 headless language-service acceptance
**Readiness:** blocked
**Depends on:** M4-03..M4-12

---

# M5 — VS Code Experience

### M5-01 — Scaffold VS Code extension package
**Readiness:** dev-ready
**Depends on:** M4

### M5-02 — Register BASIC language and syntax highlighting
**Readiness:** design-required
**Depends on:** M5-01

### M5-03 — Adapt diagnostics to VS Code
**Readiness:** dev-ready
**Depends on:** M5-01, M4-03

### M5-04 — Adapt completion and Tab workflow
**Readiness:** dev-ready
**Depends on:** M5-01, M4-08

### M5-05 — Adapt hover/navigation/references
**Readiness:** dev-ready
**Depends on:** M5-01, M4-05..M4-07

### M5-06 — Adapt document symbols
**Readiness:** dev-ready
**Depends on:** M5-01, M4-11

### M5-07 — Add check/build commands
**Readiness:** dev-ready
**Depends on:** M5-01, core CLI/build API

### M5-08 — Design extension settings/profile UX
**Readiness:** design-required
**Depends on:** M5-01

### M5-09 — Add Problems/Output reporting
**Readiness:** dev-ready
**Depends on:** M5-03, M5-07

### M5-10 — Create getting-started/sample project
**Readiness:** dev-ready
**Depends on:** M5-07

### M5-11 — Package extension and smoke-test installation
**Readiness:** dev-ready
**Depends on:** M5-02..M5-10

### M5-12 — M5 editor acceptance
**Readiness:** blocked
**Depends on:** M5-11

---

# M6 — Run Spectrum

### M6-01 — Define emulator runner abstraction
**Readiness:** design-required
**Depends on:** M5

### M6-02 — Select and document first external emulator
**Readiness:** research-required
**Depends on:** M6-01

### M6-03 — Implement emulator discovery/configuration
**Readiness:** dev-ready after M6-02
**Depends on:** M6-02

### M6-04 — Implement build-before-run pipeline
**Readiness:** dev-ready
**Depends on:** M6-01, M5-07

### M6-05 — Implement first emulator adapter
**Readiness:** dev-ready after M6-02
**Depends on:** M6-02, M6-04

### M6-06 — Add Run Spectrum VS Code command/UI
**Readiness:** dev-ready
**Depends on:** M6-05

### M6-07 — Handle artifacts/temp lifecycle and launch failures
**Readiness:** dev-ready
**Depends on:** M6-05

### M6-08 — Persist build/source identity for future debug sessions
**Readiness:** dev-ready
**Depends on:** M1 source maps, M6-04

### M6-09 — M6 edit/build/run acceptance
**Readiness:** blocked
**Depends on:** M6-03..M6-08

---

# M7 — Developer Tools

### M7-01 — Design safe line-renumber transform
**Readiness:** design-required
**Depends on:** M4 symbols/references

### M7-02 — Implement renumber preview and transform
**Readiness:** blocked
**Depends on:** M7-01

### M7-03 — Update proven literal line references during renumber
**Readiness:** blocked
**Depends on:** M7-01, M4-06/M4-07

### M7-04 — Implement formatter/canonicalizer
**Readiness:** design-required
**Depends on:** M3 source-format contract

### M7-05 — Define code-action API and first diagnostic fixes
**Readiness:** design-required
**Depends on:** M4 diagnostics

### M7-06 — Productize TAP -> source import
**Readiness:** research-required
**Depends on:** M3-09

### M7-07 — Implement semantic round-trip suite
**Readiness:** blocked
**Depends on:** M7-06

### M7-08 — Implement selected binary-preserving round-trip
**Readiness:** research-required
**Depends on:** M7-06, M3 fidelity corpus

### M7-09 — Add project/workspace navigation model
**Readiness:** design-required
**Depends on:** M4

### M7-10 — Add refactor preview/diff UX
**Readiness:** dev-ready after M7-01
**Depends on:** M7-02, M5

### M7-11 — M7 existing-program workflow acceptance
**Readiness:** blocked
**Depends on:** M7-02..M7-10

---

# M8 — ZXCode IDE / Debugging

## M8-W0 Feasibility

### M8-01 — Research BASIC runtime/source breakpoint semantics
**Readiness:** research-required
**Depends on:** M6 source/build identity

### M8-02 — Evaluate embedded/integrated emulator backend options
**Readiness:** research-required
**Depends on:** M6

### M8-03 — Define debug-machine abstraction
**Readiness:** design-required
**Depends on:** M8-01, M8-02

### M8-04 — Prove source -> encoded -> runtime address correlation
**Readiness:** research-required
**Depends on:** M8-01, M1 source maps

## M8-W1 Integrated runtime

### M8-05 — Integrate selected emulator/debug backend
**Readiness:** blocked
**Depends on:** M8-02, M8-03

### M8-06 — Implement run/pause/reset lifecycle
**Readiness:** blocked
**Depends on:** M8-05

### M8-07 — Implement source-correlated breakpoints
**Readiness:** blocked
**Depends on:** M8-04, M8-05

### M8-08 — Implement current execution source indication
**Readiness:** blocked
**Depends on:** M8-04, M8-06

## M8-W2 Inspection

### M8-09 — Implement memory inspector
**Readiness:** design-required
**Depends on:** M8-05

### M8-10 — Implement Spectrum BASIC variable inspection
**Readiness:** research-required
**Depends on:** M8-05

### M8-11 — Implement screen-memory viewer
**Readiness:** dev-ready after backend
**Depends on:** M8-05

### M8-12 — Implement variable watch UX
**Readiness:** blocked
**Depends on:** M8-10

### M8-13 — Research and implement defensible stepping semantics
**Readiness:** research-required
**Depends on:** M8-07, M8-08

### M8-14 — M8 interactive-debugging acceptance
**Readiness:** blocked
**Depends on:** M8-06..M8-13

---

# Cross-milestone critical path

```text
M1-01
 -> source/diagnostic contracts
 -> parser path
 -> authentic encoder/TAP
 -> M1 acceptance
 -> full grammar/type/symbol model
 -> complete encoder
 -> fidelity corpus
 -> language service
 -> VS Code adapter
 -> emulator runner
 -> source/runtime feasibility
 -> integrated debugger
```

## Parallelizable research tracks

These can happen ahead of their implementation milestone without destabilizing the critical path:

- Spectrum numeric encoding;
- variable-name/array/string edge cases;
- PRINT/INPUT/DATA grammar;
- charset/control/UDG fixtures;
- emulator selection;
- debugger feasibility.

# Estimated issue count

| Milestone | Issues |
|---|---:|
| M1 | 14 |
| M2 | 22 |
| M3 | 12 |
| M4 | 13 |
| M5 | 12 |
| M6 | 9 |
| M7 | 11 |
| M8 | 14 |
| **Total** | **107** |

107 issues is intentional but should not be created blindly. Before issue creation, review for tickets that are too small, merge obvious implementation pairs, and ensure every issue has a testable output.
