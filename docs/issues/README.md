# ZXCode Issue Specification Index

Issue-ready backlog after normalization.

| Milestone | File | Issues |
|---|---|---:|
| M1 — Hello Spectrum | M1-issue-specs.md | 11 |
| M2 — Authentic BASIC Core | M2-issue-specs.md | 17 |
| M3 — Spectrum Fidelity | M3-issue-specs.md | 10 |
| M4 — Language Intelligence | M4-issue-specs.md | 10 |
| M5 — VS Code Experience | M5-issue-specs.md | 9 |
| M6 — Run Spectrum | M6-issue-specs.md | 7 |
| M7 — Developer Tools | M7-issue-specs.md | 9 |
| M8 — ZXCode IDE / Debugging | M8-issue-specs.md | 9 |
| **Total** | | **82** |

## GitHub issue creation policy

When materializing these specs as GitHub issues:

1. Preserve the Mx-NN prefix in the issue title until dependencies have stable issue numbers.
2. Add readiness labels: `dev-ready`, `research-required`, `design-required`, or `blocked`.
3. Add milestone/area labels if useful, but do not encode dependencies only as labels.
4. Replace symbolic dependencies (for example M2-03) with GitHub issue links/numbers once created.
5. Do not mark a blocked ticket dev-ready merely because Codex could attempt it.
6. Acceptance criteria are part of the issue contract and should remain in the GitHub body.
7. Research tickets should end by updating the relevant design/spec docs, not only by producing code.
