# M8 — ZXCode IDE / Debugging: Issue Specifications

M8 is feasibility-gated. Tickets 1–4 must produce evidence before product/debug UI work is treated as committed scope.

## M8-01 — Research authentic BASIC runtime/debug semantics
**Readiness:** research-required
**Dependencies:** M6

Determine how the original 48K ROM tracks the current BASIC line/statement during interpretation and identify candidate statement-dispatch observation points.

### Acceptance criteria
- Relevant ROM variables/routines/state documented with primary/reference sources.
- Candidate breakpoint/observation strategy described.
- Colon-separated statements, loops, IF/THEN, GO TO and GO SUB/RETURN considered.
- Unknowns explicitly listed; no source-breakpoint promise yet.

## M8-02 — Evaluate controllable emulator/debug backends
**Readiness:** research-required
**Dependencies:** M6

Evaluate ZEsarUX/ZRCP first and compare alternatives/embedded-core options for remote pause/resume, breakpoints, memory/register access and lifecycle.

### Acceptance criteria
- At least one backend demonstrates programmatic machine control.
- Licensing/platform/transport constraints documented.
- Evidence includes repeatable commands/prototype, not documentation assumption.
- Backend choice may differ from M6 simple-run emulator.

## M8-03 — Define debug-machine adapter/protocol
**Readiness:** design-required
**Dependencies:** M8-01, M8-02

### Acceptance criteria
- Contract separates machine-level pause/resume/memory/breakpoints from BASIC semantics.
- Backend-specific ZRCP details stay in adapter.
- Capability negotiation permits weaker/stronger backends.
- Test-double backend possible.

## M8-04 — Prove source → encoded BASIC → runtime correlation
**Readiness:** research-required
**Dependencies:** M8-01, M8-03, M1 source maps

Build a spike that loads a known ZXCode-built program, observes interpreter runtime state and maps it back to source.

### Acceptance criteria
- Correct source location identified repeatedly for multiple lines.
- Test includes colon-separated statements and control-flow changes.
- Mapping method survives realistic program relocation/base-address conditions.
- Failure modes documented.
- **Gate:** if reliable mapping cannot be proven, redesign M8 before proceeding.

## M8-05 — Integrate selected debug backend and lifecycle
**Readiness:** blocked
**Dependencies:** M8-02..M8-04

### Acceptance criteria
- ZXCode can launch/attach as designed, pause/resume/reset and read required machine state.
- Backend disconnect/restart handled.
- Normal M6 Run remains usable independently.

## M8-06 — Implement BASIC source breakpoints and execution indication
**Readiness:** blocked
**Dependencies:** M8-04, M8-05

Translate source breakpoints into runtime observation/conditional machine breakpoint behaviour and map stops back to source.

### Acceptance criteria
- Breakpoints work on representative BASIC lines/statements.
- False machine-level hits auto-continue safely where design requires.
- Current execution source range shown.
- Stale source/build identity prevents misleading mapping.

## M8-07 — Implement memory and BASIC-variable inspection
**Readiness:** research-required
**Dependencies:** M8-05

Decode relevant 48K BASIC runtime variable/program state from machine memory and expose raw memory inspection.

### Acceptance criteria
- Numeric/string scalar examples inspect correctly.
- Supported arrays/types explicitly documented.
- Raw memory viewer remains available when semantic decoding is unavailable.
- Decoder is fixture-tested against known runtime state.

## M8-08 — Implement screen and watch inspection UX
**Readiness:** blocked
**Dependencies:** M8-05, M8-07

### Acceptance criteria
- Spectrum screen memory can be viewed/refreshed.
- User can watch supported BASIC variables/expressions according to defined semantics.
- Paused/running state is clearly represented.
- UI consumes debug APIs rather than emulator-specific protocol.

## M8-09 — Research BASIC stepping semantics and complete M8 acceptance
**Readiness:** research-required
**Dependencies:** M8-06, M8-07

Define and implement only stepping behaviours that can be made reliable: candidate next statement/line and GO SUB step-over/into semantics.

### Acceptance criteria
- User-facing meaning of each step command documented.
- Implementation tested across loops, IF/THEN, colon statements and subroutines.
- Unsupported semantics are omitted rather than approximated misleadingly.
- End-to-end session can run, break at source, inspect state, perform supported step, continue and reset.
