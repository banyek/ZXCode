# ZXCode

**1982 BASIC. 2026 developer experience.**

ZXCode is a modern development environment for authentic Sinclair ZX Spectrum 48K BASIC.

The goal is deliberately conservative about the language and ambitious about the tooling: write real line-numbered Sinclair BASIC, while getting the editor experience expected from a modern IDE.

## Direction

ZXCode aims to provide:

- syntax highlighting and live diagnostics;
- ZX Spectrum 48K BASIC compatibility checking;
- context-aware completion and Tab completion;
- hover documentation and navigation for line references;
- deterministic conversion of textual BASIC into authentic tokenized Spectrum BASIC;
- TAP generation;
- one-command launch in an emulator.

The language itself is not modernized. IDE features live around Sinclair BASIC rather than extending it.

## Status

M1 implementation has started. Source/diagnostic and build-artifact contracts,
recoverable parsing for the [M1 subset](docs/design/021-m1-supported-subset.md),
semantic validation, TAP container writing, and CLI help are available.
Source-to-TAP builds are not implemented yet. Unfinished design
notes remain proposals rather than implicit implementation contracts.

Decimal numeric token conversion reproduces the original 48K ROM's storage and
rounding, with independent ROM observations as fixtures. See the
[numeric contract](docs/design/020-numeric-literals.md) for evidence and the
optional Python/SkoolKit verification procedure. The production core and normal
CI do not require an emulator or ROM.

See [docs/design](docs/design/).

## Development

Use Node.js 24 LTS and npm (the repository includes an `.nvmrc`). From the root:

```sh
npm ci
npm run check
npm run zxcode -- --help
```

| Command | Purpose |
| --- | --- |
| `npm run build` | Compile core and CLI with TypeScript project references |
| `npm run typecheck` | Check both workspaces and compile-time contract tests without emitting code |
| `npm run lint` | Run ESLint with zero warnings allowed |
| `npm test` | Build and run Node's test runner |
| `npm run check` | Run type checking, lint, build, and tests |
| `npm run clean` | Remove TypeScript build outputs |
| `npm run zxcode -- --help` | Run the compiled CLI (build first) |

CI uses the same install/check commands on Node.js 24. Dependency versions are
locked in `package-lock.json`; generated output is ignored by Git.

## Implementation layout

The repository uses two private npm workspaces with native ES modules:

- `packages/core/src/source`: source identity/ranges and diagnostics.
- `packages/core/src/syntax`: physical lines, lexer, recoverable CST, and parser.
- `packages/core/src/semantic`: analysis and validated build model.
- `packages/core/src/encoding`: Spectrum numeric/program bytes and source maps.
- `packages/core/src/tap`: container writing from bytes and explicit metadata.
- `packages/cli`: host I/O and orchestration through core APIs.
- `tests`: integration and core tests using Node's built-in test runner.

Source coordinates, diagnostics, and artifact contracts are implemented; remaining
language behavior is introduced by its own M1 issues. Dependency
direction is source → syntax → semantic → encoding, where an arrow means the
right-hand layer may consume the left-hand layer. TAP handles bytes independently
of grammar. CLI depends on core; core never depends on CLI or VS Code. Core is
compiled without ambient Node/browser types, and lint rejects editor/CLI, Node
built-ins, and reverse layer imports there. Future language-service and emulator adapters sit outside
the parser/encoder pipeline.

TypeScript 6.0.3 is pinned within the supported range of TypeScript ESLint 8.71.2.
The skeleton uses no runtime framework dependencies.
