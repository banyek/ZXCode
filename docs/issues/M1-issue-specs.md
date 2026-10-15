# M1 — Hello Spectrum: Issue Specifications

## M1-01 — Establish implementation skeleton
**Readiness:** dev-ready
**Dependencies:** none

### Context
ZXCode core must remain usable from CLI, VS Code, tests and future debugger/import tooling.

### Scope
Create implementation package boundaries for source/syntax, semantic analysis, encoding, TAP, CLI and tests. Choose/build the language/toolchain configuration and standard commands. Keep editor APIs out of core.

### Non-goals
No BASIC grammar beyond scaffolding; no VS Code extension.

### Acceptance criteria
- Repository has documented build/test/lint commands.
- Core packages have one-way dependencies consistent with design docs.
- CLI executable/entry point runs a help command.
- Unit-test infrastructure runs in CI/local environment.
- No VS Code dependency exists in core packages.

---

## M1-02 — Implement source ranges and structured diagnostics
**Readiness:** dev-ready
**Dependencies:** M1-01

### Scope
Implement offsets, source ranges/locations and structured diagnostics with stable code, severity, category, message, primary range and optional related information.

### Acceptance criteria
- Multi-line UTF-8 source positions are tested.
- Diagnostics are plain core data, not rendered strings/UI objects.
- Invalid ranges cannot silently enter normal APIs.
- Diagnostic codes are stable identifiers suitable for later code actions.

---

## M1-03 — Define build artifacts and source-map contracts
**Readiness:** dev-ready
**Dependencies:** M1-01, M1-02

### Scope
Define distinct contracts for parsed document, analyzed/buildable program, encoded BASIC program and TAP artifact. Encoded results must permit source-to-byte correlation.

### Acceptance criteria
- Encoder input cannot be raw unvalidated source text.
- Encoded program exposes BASIC line offsets/lengths.
- Contract can associate encoded lines/statements with source ranges.
- TAP wrapping is separate from BASIC-program encoding.

---

## M1-04 — Implement physical-line scanner and line-number validation
**Readiness:** dev-ready
**Dependencies:** M1-02

### Scope
Read UTF-8 source as physical BASIC lines, recognize explicit decimal line numbers and preserve ranges.

### Acceptance criteria
- Valid numbered lines produce source-ranged line nodes.
- Duplicate line numbers produce a structured error.
- Missing/malformed line number produces a recoverable diagnostic.
- Ordering policy follows the source-format contract and is tested.
- Scanner never invents implicit line numbers.

---

## M1-05 — Implement recoverable lexer/parser for M1 subset
**Readiness:** dev-ready
**Dependencies:** M1-04

### Scope
Implement the real lexer/CST/parser architecture for the smallest authentic subset needed by `examples/hello.bas`, including strings, statement separators and the selected output statements. Preserve spelling and source ranges.

### Non-goals
Do not introduce a disposable “hello parser”.

### Acceptance criteria
- Valid M1 fixture parses into CST + semantic-shaped syntax nodes.
- Incomplete/malformed source returns nodes plus diagnostics instead of throwing.
- Keywords inside strings are not tokenized as BASIC commands.
- Source ranges cover tokens/nodes accurately.
- Architecture can add further ROM statements without replacement.

---

## M1-06 — Implement M1 semantic validation and BuildableProgram
**Readiness:** dev-ready
**Dependencies:** M1-05, M1-03

### Scope
Analyze the M1 syntax subset and produce either a BuildableProgram plus non-fatal diagnostics or fatal diagnostics preventing build.

### Acceptance criteria
- Encoder receives only BuildableProgram.
- Syntax/compatibility errors prevent binary build.
- Warnings do not inherently prevent build.
- No semantic stage reparses source strings.

---

## M1-07 — Research and implement authentic Spectrum numeric encoding
**Readiness:** research-required
**Dependencies:** M1-01

### Scope
Document and implement the 48K ROM BASIC numeric representation needed for source numeric literals, including the `0x0E` marker/storage rules.

### Acceptance criteria
- Algorithm is documented with primary/reference provenance.
- Tests use expected bytes obtained independently of ZXCode.
- Integer and representative non-integer/exponent cases are covered as appropriate.
- No host floating-point byte dump is mistaken for Spectrum representation.

---

## M1-08 — Implement tokenized BASIC program encoder
**Readiness:** dev-ready after M1-07
**Dependencies:** M1-03, M1-06, M1-07

### Scope
Encode the M1 BuildableProgram into authentic Spectrum BASIC program bytes: line headers, token bytes, text/string bytes, numeric representations and line terminators.

### Acceptance criteria
- Output is deterministic.
- Keyword tokenization is context-correct for supported syntax.
- Strings retain keyword-looking text literally.
- Encoded line metadata maps back to source.
- Unit tests compare exact expected bytes.

---

## M1-09 — Implement TAP writer
**Readiness:** dev-ready
**Dependencies:** M1-01

### Scope
Implement the TAP container structures required to store/load an M1 BASIC program, including header/data blocks and checksums.

### Acceptance criteria
- TAP block lengths/flags/checksums are unit-tested.
- BASIC metadata needed for load/autostart policy is explicit.
- TAP writer accepts encoded bytes; it does not know BASIC grammar.
- Exact TAP bytes are testable deterministically.

---

## M1-10 — Implement check/build CLI and orchestration
**Readiness:** dev-ready
**Dependencies:** M1-06, M1-08, M1-09

### Scope
Provide `zxcode check <file>` and `zxcode build <file>` through the shared core pipeline.

### Acceptance criteria
- `check` reports structured diagnostics in a useful CLI representation and emits no TAP.
- `build` refuses fatal diagnostics and writes a TAP on success.
- Exit status distinguishes success/failure.
- Output path behaviour is documented/tested.
- CLI contains no alternate parser/encoder logic.

---

## M1-11 — Establish independent golden fixture and end-to-end emulator acceptance
**Readiness:** research-required
**Dependencies:** M1-10

### Scope
Create `examples/hello.bas`, independently establish expected BASIC/TAP bytes, select a reference emulator for acceptance, and document/reproduce the load/run result.

### Acceptance criteria
- Expected binary did not originate from ZXCode itself.
- Automated test compares exact generated bytes.
- Generated TAP loads in the selected reference emulator as 48K BASIC.
- Running it prints `HELLO WORLD`.
- Procedure is documented sufficiently for another developer/agent to reproduce.
