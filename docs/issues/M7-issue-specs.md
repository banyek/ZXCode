# M7 — Developer Tools: Issue Specifications

## M7-01 — Design safe BASIC renumber semantics
**Readiness:** design-required
**Dependencies:** M4 symbol/reference model

Specify line selection/range/step behaviour and exactly which semantic references can be rewritten.

**Acceptance criteria:** literal proven line references distinguished from arbitrary numeric expressions; GO TO/GO SUB/RESTORE and other applicable constructs enumerated; collisions/range failures specified; preview model defined.

## M7-02 — Implement renumber transform and preview
**Readiness:** blocked
**Dependencies:** M7-01

**Acceptance criteria:** line declarations and proven references update atomically; unrelated numeric literals unchanged; conflicts abort safely; preview/diff available before apply; regression fixtures include control-flow chains.

## M7-03 — Implement formatter/canonicalizer
**Readiness:** design-required
**Dependencies:** M3 source-format contract

**Acceptance criteria:** formatting never changes program semantics; case/spacing choices explicit; raw/string/REM content preserved; idempotence tested.

## M7-04 — Define code-action API and first safe fixes
**Readiness:** design-required
**Dependencies:** M4 diagnostics

**Acceptance criteria:** actions keyed by stable diagnostic codes; edits are source-ranged and previewable; only unambiguous fixes auto-offered.

## M7-05 — Productize TAP to source import
**Readiness:** research-required
**Dependencies:** M3 decoder spike

**Acceptance criteria:** supported tokenized BASIC TAP converts to valid ZXCode source; unsupported/raw constructs surfaced without silent loss; import provenance/options documented.

## M7-06 — Implement semantic round-trip suite
**Readiness:** blocked
**Dependencies:** M7-05

**Acceptance criteria:** TAP -> source -> TAP executes equivalently for documented supported corpus; normalization differences explicitly allowed/tested.

## M7-07 — Implement selected binary-preserving round-trip
**Readiness:** research-required
**Dependencies:** M7-05, M3 corpus

Identify and support the subset where exact BASIC-program bytes can be reproduced.

**Acceptance criteria:** guarantee scope documented; exact-byte fixtures pass; unsupported preservation cases do not falsely claim fidelity.

## M7-08 — Add workspace/project navigation model
**Readiness:** design-required
**Dependencies:** M4

Support multiple BASIC documents where useful without inventing non-authentic cross-file language semantics.

**Acceptance criteria:** workspace discovery/navigation has clear boundaries; single-file behaviour unchanged; no implicit linker/module semantics.

## M7-09 — M7 existing-program workflow acceptance
**Readiness:** blocked
**Dependencies:** M7-02..M7-08

**Acceptance criteria:** representative existing TAP can be imported, navigated, safely renumbered/formatted where requested, rebuilt and pass documented semantic/binary preservation guarantees.
