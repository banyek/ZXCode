# ZXCode agent instructions

## Product principle

ZXCode means **1982 BASIC, 2026 developer experience**.

The source language is authentic Sinclair ZX Spectrum 48K ROM BASIC. Modern conveniences belong in tooling, not in a new BASIC dialect.

## Compatibility authority

When compatibility is uncertain:

1. Prefer documented behaviour of the original ZX Spectrum 48K ROM and original Sinclair documentation.
2. Use ROM disassembly as an implementation-level reference.
3. Use existing tools such as BAS2TAP and zmakebas as independent comparison points, not as the definition of the language.
4. Do not invent syntax or silently accept constructs merely because another BASIC dialect accepts them.

The emulator is a test target, not the definition of the language.

## Architecture

Keep the language core independent from VS Code.

Expected conceptual layers:

- language model / parser
- diagnostics
- Spectrum BASIC encoder
- TAP writer
- language service
- CLI
- VS Code extension
- emulator integration

Parser, diagnostics, language service, and encoder should share one language model so that editor acceptance and build behaviour cannot drift apart.

## Source-language constraints

Unless a later accepted design document explicitly changes these rules:

- target ZX Spectrum 48K with original 48K ROM BASIC;
- real BASIC line numbers are required;
- do not introduce labels, WHILE/WEND, implicit line numbering, or other convenience syntax;
- preserve REM contents according to original Spectrum semantics;
- do not tokenize keyword-looking text blindly; Sinclair BASIC requires context-sensitive handling;
- distinguish syntax/compatibility errors from semantic warnings and editor hints.

## Engineering rules

- Prefer deterministic behaviour and byte-level fixtures.
- Compatibility tests should use independently produced reference data where possible.
- Do not make a test pass by changing expected binary output without establishing why the new output is authentic.
- Complex grammar rules belong in parser code; declarative metadata may describe tokens, documentation, completion, and simple syntax facts.
- Design documents may contain open questions. Do not silently resolve them during implementation; document the decision first.
