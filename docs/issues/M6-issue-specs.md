# M6 — Run Spectrum: Issue Specifications

## M6-01 — Define emulator runner abstraction
**Readiness:** design-required
**Dependencies:** M5

Define build-artifact launch request/result, lifecycle and backend capability reporting without tying core to one emulator CLI.

**Acceptance criteria:** external process runner can implement contract; future debug backend can coexist; BASIC parser/core does not depend on emulator.

## M6-02 — Select and document first external emulator
**Readiness:** research-required
**Dependencies:** M6-01

Evaluate practical supported-platform emulator launch behaviour, licensing/distribution implications and automation surface.

**Acceptance criteria:** selection rationale documented; required command-line/config behaviour reproduced; fallback/manual configuration documented.

## M6-03 — Implement first emulator adapter and configuration
**Readiness:** dev-ready after M6-02
**Dependencies:** M6-02

**Acceptance criteria:** executable discovery/explicit path supported; TAP launches reproducibly; platform-specific arguments isolated in adapter; actionable configuration errors.

## M6-04 — Implement build-before-run orchestration and artifact lifecycle
**Readiness:** dev-ready
**Dependencies:** M6-01, M5-06

**Acceptance criteria:** run uses same build pipeline as normal build; failed build prevents launch; temporary/output artifact policy deterministic; launch/process errors surfaced.

## M6-05 — Add Run Spectrum VS Code command/UI
**Readiness:** dev-ready
**Dependencies:** M6-03, M6-04

**Acceptance criteria:** one user action builds and launches; command available from sensible editor context; repeated runs behave predictably; UI does not contain emulator-specific business logic.

## M6-06 — Persist build/source identity for future debugging
**Readiness:** dev-ready
**Dependencies:** M1 source-map contract, M6-04

Associate launched artifact with source version/build identity/source map so later debug tooling can know exactly what is running.

**Acceptance criteria:** identity invalidates when source/build changes; metadata accessible to future session layer; TAP itself need not be modified.

## M6-07 — M6 edit/build/run acceptance
**Readiness:** blocked
**Dependencies:** M6-03..M6-06

**Acceptance criteria:** clean setup following docs can open sample, invoke Run Spectrum and observe authentic program execution in selected emulator; failures for missing emulator/build errors are useful.
