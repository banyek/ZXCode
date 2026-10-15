# Vision and principles

## Vision

ZXCode is a modern IDE experience for programs that remain genuine Sinclair ZX Spectrum 48K BASIC.

A program accepted and built by ZXCode should still belong to the original machine's world. The editor may understand far more about the program than the 1982 editor did, but that intelligence must not leak into a private ZXCode-only BASIC dialect.

## Core principle

> 1982 BASIC. 2026 developer experience.

Example source:

```basic
10 BORDER 0: PAPER 0: INK 7: CLS
20 LET X=0
30 PRINT AT 10,X;"*"
40 LET X=X+1
50 IF X<31 THEN GO TO 30
60 STOP
```

## Modern tooling around the language

Planned capabilities include syntax highlighting, diagnostics, hover documentation, context-aware completion, Tab completion, line-number completion after constructs such as GO TO and GO SUB, navigation to referenced lines, deterministic TAP builds, and emulator launch.

Possible later capabilities include renumber/refactoring support, embedded emulation, debugger integration, variable/memory inspection, screen-memory tools, and TAP import/round-trip workflows.

## Non-goals for the initial language

ZXCode does not initially define a modernized Spectrum BASIC. In particular, labels, WHILE/WEND, automatic source line numbering, and other syntax sugar are outside the language contract.

## Architectural principle

The core must not depend on VS Code.

```text
source.bas
    |
ZXCode language core
  |       |       |
parser  encoder  diagnostics
  |       |
language service / CLI
          |
    VS Code extension
          |
       emulator
```

This allows the same compatibility logic to serve editor tooling, command-line builds, tests, and future integrations.
