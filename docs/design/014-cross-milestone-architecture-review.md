# Cross-Milestone Architecture Review v0.1

## Result

The eight-milestone roadmap is viable, with one correction: **fidelity is an invariant, not something introduced by M3**. M3 is therefore a hardening/coverage milestone, while M1 and M2 must already encode their supported subset authentically.

No additional milestone is currently necessary.

## Decisions forced backwards from M7/M8

### 1. Preserve source spans from M1

Refactoring, diagnostics and debugging all need stable source locations. CST and semantic nodes therefore carry source ranges from the first implementation.

### 2. Encoder returns metadata, not only bytes

Proposed result:

```text
EncodedProgram
  programBytes
  lines[]
    sourceLineNumber
    sourceRange
    encodedOffset
    encodedLength
    statements[]
      sourceRange
      encodedRange?
```

Exact granularity can evolve, but the API must permit source/runtime correlation.

### 3. Canonical identities + original spelling

Symbols need canonical Spectrum identity for analysis and original spelling/source slices for editing and round-trip.

### 4. Diagnostics are structured

Do not emit plain strings from core.

```text
Diagnostic
  code
  severity
  category
  message
  sourceRange
  related[]
  capability?
```

Stable diagnostic codes enable VS Code code actions in M7.

### 5. Build artifacts are explicit

The CLI/build layer should distinguish:

- parsed document;
- analyzed/buildable program;
- encoded BASIC image;
- TAP container.

This allows import, debugger and alternative container work without re-parsing arbitrary bytes.

### 6. Machine/emulator boundary is independent

Suggested future-facing interface concepts:

```text
MachineRunner
  launch(artifact, options)

DebugMachine   // later
  pause/resume/reset
  readMemory
  readRegisters
  setBreakpoint...
```

M6 only needs the first capability. M8 may use a richer backend. Do not require every external emulator to implement debugging.

### 7. Project model stays lightweight initially

M1–M4 should work on a single file. Project/workspace abstractions can wrap documents later. Avoid inventing a build-system DSL before a real need appears.

## Risks

### Historical correctness risk

Mitigation: primary ROM/manual references + independent binary fixtures.

### Parser complexity risk

Mitigation: ROM command classes, dedicated special-statement parsers, recoverable CST, shared expression parser.

### Round-trip risk

Mitigation: source/raw preservation decisions are made before escape syntax is frozen; M3 contains import/decode validation spike.

### Debugger feasibility risk

BASIC execution does not map as cleanly to source breakpoints as machine-code debugging. M8 stepping/breakpoint semantics must be proven with an emulator/runtime spike before product promises become strict.

### Scope risk

The project can become an emulator project. M8 should prefer integrating a proven emulator core/backend unless building an emulator becomes an explicit separate goal.

## Conclusion

Proceed with M1–M8. Before implementation, convert this roadmap into GitHub milestones and issue groups, then perform a dependency/readiness pass. M1 can become fully dev-ready; later milestones may intentionally retain research/design tickets.
