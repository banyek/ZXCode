# M5 — VS Code Experience: Issue Specifications

## M5-01 — Scaffold VS Code extension
**Readiness:** dev-ready
**Dependencies:** M4

Create extension package, activation boundaries and adapter layer around core language service.

**Acceptance criteria:** extension loads in development host; core remains editor-independent; extension has automated smoke-test path.

## M5-02 — Register ZX Spectrum BASIC language and highlighting
**Readiness:** design-required
**Dependencies:** M5-01

**Acceptance criteria:** .bas association policy avoids unreasonable conflicts; authentic keywords/comments/strings/numbers highlighted; visual grammar does not define parser truth.

## M5-03 — Surface diagnostics in VS Code
**Readiness:** dev-ready
**Dependencies:** M5-01, M4-03

**Acceptance criteria:** ranges/severities/codes preserved; document edits refresh diagnostics; stale diagnostics removed.

## M5-04 — Integrate completion and Tab workflow
**Readiness:** dev-ready
**Dependencies:** M5-01, M4-06

**Acceptance criteria:** context candidates shown; Tab can accept completion through normal VS Code mechanisms; snippets remain authentic BASIC text; no language logic duplicated in extension.

## M5-05 — Integrate hover, definition, references and symbols
**Readiness:** dev-ready
**Dependencies:** M5-01, M4-05, M4-08

**Acceptance criteria:** Cmd/Ctrl-click line navigation works; variable/FN queries work; document outline available; adapter conversions tested.

## M5-06 — Add build/check commands and reporting
**Readiness:** dev-ready
**Dependencies:** M5-01, M1 build API

**Acceptance criteria:** commands operate on active/specified BASIC source; Problems/Output provide useful failures; generated TAP location visible; no shelling out to duplicate parser logic.

## M5-07 — Design extension settings and target-profile UX
**Readiness:** design-required
**Dependencies:** M5-01

**Acceptance criteria:** minimal settings cover output/profile/emulator-preparation needs without inventing a project DSL; defaults documented; settings schema versionable.

## M5-08 — Create getting-started flow and sample
**Readiness:** dev-ready
**Dependencies:** M5-04..M5-07

**Acceptance criteria:** new user can open sample, see intelligence and build TAP following short documentation.

## M5-09 — Package and accept first editor release
**Readiness:** blocked
**Dependencies:** M5-02..M5-08

**Acceptance criteria:** installable VSIX/package built reproducibly; clean VS Code profile smoke test passes; open/edit/diagnose/complete/navigate/build workflow demonstrated.
