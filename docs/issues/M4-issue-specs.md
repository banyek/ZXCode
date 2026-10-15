# M4 — Language Intelligence: Issue Specifications

## M4-01 — Define editor-independent language-service contract
**Readiness:** dev-ready
**Dependencies:** M3

Define document input/versioning, diagnostics, completion, hover/navigation, symbols and query result types using core positions/ranges only.

**Acceptance criteria:** no VS Code types/dependencies; API supports incomplete documents; contract is testable headlessly.

## M4-02 — Implement document analysis/session model
**Readiness:** design-required
**Dependencies:** M4-01

Create the reusable document analysis layer that owns parse/semantic results and can later support editor update cycles.

**Acceptance criteria:** repeated queries reuse a coherent analysis snapshot; version identity prevents stale result confusion; implementation does not require premature complex incremental parsing.

## M4-03 — Expose diagnostics through language service
**Readiness:** dev-ready
**Dependencies:** M4-02

**Acceptance criteria:** syntax/compatibility/semantic/style categories retain stable codes and ranges; diagnostics work on incomplete source; no CLI/editor formatting leaks into result.

## M4-04 — Implement semantic symbol index
**Readiness:** dev-ready
**Dependencies:** M4-02

Index BASIC lines, variables/arrays and DEF FN symbols/uses with canonical identities.

**Acceptance criteria:** source definitions/uses queryable; dynamic expression line targets are not falsely indexed as static references.

## M4-05 — Implement hover, definition and references queries
**Readiness:** dev-ready
**Dependencies:** M4-04

**Acceptance criteria:** literal line references navigate to target lines; variables/functions expose useful hover/type data; references use semantic identity; unresolved symbols fail gracefully.

## M4-06 — Implement parser-state/context-aware completion
**Readiness:** design-required
**Dependencies:** M4-02, M4-04

Completion derives candidates from syntactic/semantic context rather than a global keyword dump.

**Acceptance criteria:** statement start, PRINT item, expression, FOR/STEP, IF/THEN and string/numeric contexts fixture-tested; GO TO/GO SUB rank existing line numbers; API does not assume Tab as acceptance key.

## M4-07 — Add documentation/signature metadata
**Readiness:** research-required
**Dependencies:** M4-01

**Acceptance criteria:** supported commands/functions have concise authentic syntax/help data; metadata source/provenance recorded; same data can feed hover/completion.

## M4-08 — Implement document symbols
**Readiness:** dev-ready
**Dependencies:** M4-04

**Acceptance criteria:** BASIC lines and meaningful structures appear in stable document order; ranges valid on malformed documents; no invented modern module structure.

## M4-09 — Build incomplete-source language-service fixtures
**Readiness:** dev-ready
**Dependencies:** M4-03, M4-06

Fixture cursor positions such as `PRINT AT 10,`, `GO TO `, `FOR I=1 TO` and malformed strings/statements.

**Acceptance criteria:** expected diagnostics/completions/navigation serialized and regression-tested.

## M4-10 — M4 headless language-service acceptance
**Readiness:** blocked
**Dependencies:** M4-03..M4-09

**Acceptance criteria:** tests can query diagnostics/completion/hover/definition/references/symbols without VS Code; valid and incomplete documents do not crash; result ranges map exactly to source.
