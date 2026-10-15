# ZXCode Roadmap — M1 to M8

Status: architecture planning baseline.

## Roadmap principle

Milestones are vertical capability increments, not arbitrary batches of tickets. Each milestone must leave the repository in a coherent, demonstrable state.

Later requirements are allowed to constrain earlier architecture. In particular:

- M7 requires source fidelity and stable semantic identities;
- M8 requires source-to-encoded-program mapping and a clean emulator/debug boundary;
- therefore M1 must not discard source spans or make the encoder opaque.

## M1 — Hello Spectrum

### Goal

Prove the complete authentic build path with the smallest useful BASIC program.

```text
hello.bas
 -> source model
 -> lexer
 -> parser
 -> semantic validation
 -> Spectrum BASIC encoder
 -> BASIC program image
 -> TAP writer
 -> hello.tap
 -> reference emulator
```

### Scope

- project/toolchain skeleton;
- physical BASIC lines and line numbers;
- enough lexical/parser support for the hello fixture;
- source spans retained through parsing;
- token encoding for required statements;
- authentic numeric encoding for required literals;
- BASIC line/program binary representation;
- TAP header/data blocks and checksum;
- CLI `check` and `build`;
- exact binary golden fixture;
- emulator smoke-test procedure.

### Architectural obligations

Even though grammar coverage is intentionally tiny, M1 interfaces must anticipate:

- recoverable CST;
- semantic AST;
- source mapping;
- complete token catalogue;
- later alternate output/import consumers.

### Non-goals

Broad BASIC support, IDE integration, sophisticated diagnostics, embedded emulator.

### Definition of Done

`examples/hello.bas` builds deterministically to a TAP containing an authentic 48K BASIC program that loads/runs in the reference emulator and prints `HELLO WORLD`. Exact expected binary output is tested.

---

## M2 — Authentic BASIC Core

### Goal

Make ZXCode a useful compiler/tokenizer/checker for ordinary 48K BASIC programs.

### Scope

- all ROM command grammar;
- expression parser and precedence;
- numeric/string typing;
- variables and arrays;
- strings and slicing;
- FOR/NEXT;
- IF/THEN;
- GO TO / GO SUB / RETURN;
- PRINT/INPUT;
- DATA/READ/RESTORE;
- DIM;
- DEF FN;
- graphics/sound/I/O statements;
- cassette statement grammar;
- capability tagging for Interface 1-oriented ROM vocabulary;
- robust multi-statement lines;
- parser error recovery;
- semantic line index.

### DoD

A representative corpus covering the 48K language parses, analyzes and encodes without VS Code-specific code. Unsupported/invalid constructs produce categorized diagnostics rather than crashes or silent corruption.

---

## M3 — Spectrum Fidelity

### Goal

Turn broad language support into a compatibility-grade toolchain.

### Scope

- exact Spectrum numeric literal encoding;
- complete character map;
- control codes;
- block graphics;
- UDG representation;
- REM/raw-content behaviour;
- keyword/string edge cases;
- source escape syntax frozen from fixtures;
- TAP edge cases and autostart metadata;
- independent cross-validation corpus;
- TAP import/decode spike sufficient to validate round-trip assumptions;
- deterministic binary output across platforms.

### Important boundary correction

Some fidelity work is not allowed to wait until M3. M1 must already implement authentic encoding for every construct it emits, and M2 must not knowingly use placeholder encoding. M3 expands and hardens fidelity across the complete weird surface of the machine.

### DoD

The compatibility fixture suite demonstrates byte-level agreement with independently established references for the supported corpus, including deliberately awkward programs.

---

## M4 — Language Intelligence

### Goal

Expose the language core as an editor-independent language service.

### Scope

- incremental/recoverable document analysis API;
- diagnostics API;
- symbol index;
- variable/function hover data;
- line-target semantic relations;
- definition/reference navigation;
- context-aware completion;
- line-number completion;
- documentation metadata;
- document symbols;
- incomplete-source completion fixtures.

### API principle

No VS Code types cross into the core language-service package.

### DoD

Headless tests can ask questions such as “completions at offset N”, “definition of this target”, and “diagnostics for this document” and receive stable source-ranged results.

---

## M5 — VS Code Experience

### Goal

Deliver the first polished user-facing ZXCode editor.

### Scope

- extension packaging;
- language registration;
- syntax highlighting;
- diagnostics presentation;
- completion + Tab acceptance;
- hover;
- Go to Definition;
- references;
- document symbols;
- build/check commands;
- output/problem reporting;
- settings for build/profile paths;
- example project / getting-started flow.

### Architecture

The extension adapts VS Code documents/positions/settings to ZXCode core APIs. It does not contain Spectrum grammar.

### DoD

A user can install the extension, open an authentic `.bas` file, receive language intelligence, build it, and inspect errors without using the CLI manually.

---

## M6 — Run Spectrum

### Goal

Close the edit/build/run loop.

### Scope

- emulator abstraction;
- first supported external emulator;
- emulator discovery/configuration;
- build-before-run;
- temporary/artifact lifecycle;
- Run command/button;
- useful launch errors;
- target/profile configuration;
- source/build identity retained for future debugging.

### Boundary

ZXCode should launch through an emulator adapter interface. Do not bake Fuse command-line assumptions into the language core.

### DoD

From an open BASIC file/project, one action builds the program and launches it in the supported emulator.

---

## M7 — Developer Tools

### Goal

Add capabilities that make authentic line-numbered BASIC materially easier to maintain without changing the language.

### Scope

- safe renumbering;
- update literal line references during renumber;
- references/find usages;
- formatting/canonicalization;
- code actions for selected diagnostics;
- TAP -> source import;
- semantic and selected binary-preserving round-trip;
- project-level navigation;
- richer compatibility/profile diagnostics;
- optional refactor previews/diffs.

### Renumber rule

Only references proven semantically to be line targets may be rewritten. Numeric literals that merely happen to equal a line number must not change.

### DoD

A non-trivial existing Spectrum BASIC program can be imported/edited/refactored/exported with explicit, testable preservation guarantees.

---

## M8 — ZXCode IDE / Debugging

### Goal

Make ZXCode a modern interactive development environment while still executing authentic Spectrum programs.

### Scope

- embedded emulator or deeply integrated emulator backend;
- run/pause/reset;
- source-line breakpoints;
- execution position mapped back to BASIC source;
- variable watch;
- memory inspector;
- screen-memory viewer;
- BASIC program/variable-area inspection;
- breakpoint/source-map persistence;
- debug protocol boundary;
- optional stepping semantics where technically sound.

### Critical dependency

M8 depends on information preserved since M1:

```text
source span
 -> semantic statement
 -> encoded BASIC line/offset
 -> runtime BASIC program location
```

If the encoder discards this relationship, debugging becomes reverse engineering of our own output.

### DoD

A user can run an authentic BASIC program, stop execution at a source-correlated point, inspect meaningful machine/BASIC state, and continue/reset from the ZXCode environment.

---

# Cross-milestone invariants

These are architecture contracts, not milestone features.

## A. Source identity survives

Every meaningful syntax/semantic node retains a source range. Encoding can emit source-map metadata even when TAP itself cannot contain it.

## B. Authentic bytes only

No milestone may knowingly emit a temporary fake representation and call it Spectrum output.

## C. Core does not know VS Code

CLI, tests, VS Code, import tools and debugger all consume shared core packages.

## D. Parser is editor-capable from the beginning

M1 may expose only minimal diagnostics, but its syntax representation must permit recovery/incomplete nodes rather than force a later parser replacement.

## E. Encoder is not a parser

Only validated semantic/build models enter the encoder.

## F. Emulator is behind an adapter

External launch in M6 and embedded/debug integration in M8 share a conceptual machine interface without coupling BASIC semantics to one emulator.

## G. Profiles are explicit

ROM vocabulary, machine capabilities and extension hardware are separate concepts.

## H. Golden fixtures are permanent

Every newly supported language/encoding edge case adds fixtures; later milestones cannot weaken earlier binary guarantees.

# Milestone dependency graph

```text
M1 Hello Spectrum
 |
 v
M2 Authentic BASIC Core
 |
 v
M3 Spectrum Fidelity
 |
 +------------------+
 |                  |
 v                  |
M4 Language         |
Intelligence        |
 |                  |
 v                  |
M5 VS Code          |
 |                  |
 +--------+---------+
          |
          v
     M6 Run Spectrum
          |
          v
     M7 Developer Tools
          |
          v
     M8 IDE / Debugging
```

The graph is intentionally mostly linear for delivery clarity, but architecture work for M7/M8 constrains M1–M3 from day one.

# Readiness labels

Future issues should carry one of:

- `dev-ready` — contract sufficiently specified to implement;
- `research-required` — historical/ROM behaviour must be established first;
- `design-required` — product/API decision still open;
- `blocked` — dependency not yet satisfied.

A later milestone can have tickets in the repository without pretending all of them are dev-ready.
