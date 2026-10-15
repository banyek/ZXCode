# ZXCode Normalized Backlog v0.2

This document normalizes the first 107-ticket decomposition into implementation-sized work units.

## Normalization rules

Merge when:
- two tickets cannot be meaningfully accepted independently;
- one is only plumbing for the next;
- splitting would cause Codex to create artificial intermediate APIs.

Keep separate when:
- independent research can invalidate implementation;
- binary compatibility deserves its own gate;
- a user-visible capability has a distinct acceptance test.

## Result

The normalized target is **82 issues**.

| Milestone | v0.1 | v0.2 |
|---|---:|---:|
| M1 | 14 | 11 |
| M2 | 22 | 17 |
| M3 | 12 | 10 |
| M4 | 13 | 10 |
| M5 | 12 | 9 |
| M6 | 9 | 7 |
| M7 | 11 | 9 |
| M8 | 14 | 9 |
| **Total** | **107** | **82** |

## Major merges

### M1
- repository skeleton + core contracts remain distinct;
- minimal lexer/parser are merged into one vertical syntax ticket;
- CLI check/build is merged with build orchestration;
- emulator smoke procedure + end-to-end acceptance become one acceptance ticket.

### M2
- related simple command classes are grouped;
- line-control statements are grouped;
- arrays + DIM are grouped;
- DATA/READ/RESTORE remain one feature;
- complete encoding + corpus acceptance are grouped where implementation is inseparable.

### M3
- block graphics + UDG source representation share one special-character design ticket;
- control/charset fixtures drive escape-syntax freeze;
- deterministic/cross-validation acceptance is consolidated.

### M4
- hover/definition/references share the symbol-query infrastructure;
- document symbols remain separate;
- completion + line-target ranking are one completion subsystem.

### M5
- editor navigation adapters are grouped;
- packaging/install smoke testing joins release acceptance.

### M6
- discovery/configuration + first adapter are grouped after emulator selection;
- artifact lifecycle/error handling joins run orchestration.

### M7
- renumber transform + proven line-reference updates are one atomic refactor feature;
- semantic/binary round-trip remain separate because guarantees differ.

### M8
M8 is deliberately reduced and gated:
1. runtime/debug semantics research;
2. emulator backend evaluation;
3. debug protocol/adapter design;
4. source-to-runtime correlation proof;
5. backend integration/lifecycle;
6. BASIC breakpoint/execution mapping;
7. memory/BASIC-variable inspection;
8. screen/watch UX;
9. stepping + final acceptance.

No detailed debugger UI work is dev-ready until tickets 1–4 pass.

# Normalized milestone summaries

## M1 — 11 issues
Foundation/contracts; minimal syntax; semantic build model; numeric encoding research/implementation; BASIC encoder; TAP writer; build CLI; independent golden fixture; emulator acceptance.

## M2 — 17 issues
Token catalogue; expressions; variables/symbols; typing; simple statements; control flow; FOR/NEXT; PRINT; INPUT; arrays/DIM/slicing; DATA family; DEF FN; REM; listing/cassette grammar; capability commands; complete encoding/corpus acceptance.

## M3 — 10 issues
Numeric hardening; charset; controls; UDG/block graphics; escape format; lexical edge cases; TAP hardening; decoder/import spike; independent corpus; fidelity acceptance.

## M4 — 10 issues
Language-service contract; document model; diagnostics; symbols; navigation/hover/references; completion; docs metadata; document symbols; incomplete-source fixtures; acceptance.

## M5 — 9 issues
Extension scaffold; language/highlighting; diagnostics; completion; navigation; build commands/reporting; settings UX; getting started; packaging/acceptance.

## M6 — 7 issues
Runner abstraction; emulator selection; adapter/configuration; build/run orchestration; VS Code Run UI; source/build identity; acceptance.

## M7 — 9 issues
Renumber design; renumber implementation; formatter; code actions; TAP import; semantic round-trip; binary-preserving subset; workspace navigation; acceptance.

## M8 — 9 issues
Feasibility first, product second. See debugger research note.
