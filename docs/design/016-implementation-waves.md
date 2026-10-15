# ZXCode Implementation Waves v0.1

## Purpose

Milestones describe user-visible capability. Waves describe safe implementation order for Codex/agents.

## Global rule

Do not start a wave merely because earlier tickets have code. Start it when prerequisite contracts/tests are merged and stable.

## Wave A — Core foundations

M1-01..M1-07.

Outcome: source -> recoverable syntax -> semantic/build model exists, without pretending binary output is finished.

## Wave B — Authentic output

M1-08..M1-14.

Outcome: first real TAP and independently checked end-to-end hello program.

**Gate:** M1 acceptance must pass before broad grammar implementation.

## Wave C — Language breadth

M2-01..M2-19, internally dependency-ordered and parallelized where safe.

Outcome: parser/semantic model understands ordinary 48K BASIC.

## Wave D — Complete encoding + corpus

M2-20..M2-22 plus early M3 research.

Outcome: broad BASIC corpus builds.

## Wave E — Fidelity hardening

M3-01..M3-12.

Outcome: weird Spectrum-specific binary/text cases are compatibility fixtures rather than folklore.

## Wave F — Headless IDE intelligence

M4.

Outcome: editor-independent language service.

## Wave G — VS Code product

M5.

Outcome: installable editor experience.

## Wave H — Run loop

M6.

Outcome: one-action build/run in external emulator.

## Wave I — Refactoring/import

M7.

Outcome: maintaining existing authentic BASIC becomes pleasant and safe.

## Wave J — Debug feasibility gate

M8-01..M8-04.

Outcome: evidence that promised BASIC debugging semantics are technically defensible.

**Hard gate:** do not build the full M8 UI before this passes.

## Wave K — Integrated ZXCode IDE

M8-05..M8-14.

Outcome: interactive integrated runtime/debugging environment.

## Codex execution policy

For autonomous implementation sessions:

1. Work only on tickets marked dev-ready and whose dependencies are merged.
2. Prefer one coherent wave/sub-wave per session.
3. Add/extend tests before declaring a ticket complete.
4. Never resolve a research-required question by guessing.
5. If implementation exposes a spec conflict, stop that ticket and document the conflict rather than silently changing compatibility behaviour.
6. Preserve architectural boundaries in AGENTS.md and design docs.
7. Merging should occur only after the relevant acceptance/golden tests pass.
