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

M1 and M2 are implemented and verified. The host-independent core parses,
validates and encodes all fifty original 48K ROM command grammars, expressions,
numeric/string variables and arrays, slicing, control flow, PRINT/INPUT,
DATA/READ/RESTORE, DEF FN/FN, REM, and listing/cassette forms. The CLI checks source
and builds TAP files through that same model, retaining source maps and categorized
diagnostics. IDE integration and full M3 fidelity work follow.

The [M2 acceptance corpus](docs/design/026-m2-core-acceptance.md) covers all commands
and built-in signatures with independent byte fixtures. A combined arrays, DATA,
functions and channels program loads/runs in the original ROM, displays `CORE OK`,
and returns `0 OK, 100:1`. M1's hello bytes and load/run acceptance remain intact.

Decimal conversion reproduces original-ROM storage and rounding; see the
[numeric contract](docs/design/020-numeric-literals.md). M3 numeric lexical hardening now includes the ROM’s contextual fraction/exponent
whitespace rules. The shared 256-byte Spectrum character map is implemented; controls, graphics/UDG
notation and named/raw text escapes are active in quoted strings and REM tails. Control packets now have checked internal
encoding and lossless text-byte decoding, including truncated-packet diagnostics.
Printable literals include Spectrum £, © and ↑ alongside the existing ASCII
coverage (backtick is excluded); strings support doubled quotes and REM tails
retain literal source bytes. Production and normal CI require
neither an emulator nor a ROM.

CAT, FORMAT, MOVE and ERASE build with nonfatal runtime-capability warnings on the
default 48K target. OPEN # and CLOSE # support base-ROM channels. Explicit core
`targetProfile` options declare execution capabilities without changing grammar;
see the [capability policy](docs/design/025-runtime-capability-policy.md).

Text escapes use `{INK 2}`, `{AT 1,2}`, `{TAB 258}`, `{UDG A}`, `{BLOCK 15}` and
`{BYTE 0xFF}`. Double literal braces as `{{` and `}}`; backslashes remain literal.
Byte 13 is supported in REM; quoted strings use ordinary `CHR$ 13` expressions.
See the [source escape contract](docs/design/028-text-source-escapes.md) and
[working example](examples/escapes.bas).

See [docs/design](docs/design/).

## Check and build

After building the toolchain:

```sh
npm run zxcode -- check examples/hello.bas
npm run zxcode -- build examples/hello.bas --output /tmp/hello.tap
npm run zxcode -- build examples/hello.bas --output /tmp/hello.tap --autostart 10
```

`check` creates no TAP. Builds default to a `.tap` beside the source, a space-padded
Spectrum filename from the source basename (1..10 representable characters), and
no autostart. Use `--output`/`-o`, `--name`, and `--autostart` to override these.
Fatal diagnostics leave previous artifacts untouched; a successful build replaces
the output artifact. The source file and its existing aliases cannot be output
destinations. See the [CLI policy](docs/design/023-m1-cli-build-policy.md) for exit
codes, metadata, UTF-8 behavior, and output paths.

The [M1 acceptance procedure](docs/design/024-m1-acceptance.md) documents independent
golden provenance and an optional original-ROM load/run check with retained screen
and snapshot evidence. Normal tests compare exact BASIC/TAP bytes without requiring
an emulator installation.

The [lexical audit](docs/design/011-text-source-format.md#m3-06-lexical-context-audit)
also provides `scripts/research/smoke-escapes.py --output-dir PATH` for optional
original-ROM verification of raw REM data, escaped bytes and colour controls.

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
- `packages/core/src/decoding`: independent text-byte packet decoding.
- `packages/core/src/tap`: container writing from bytes and explicit metadata.
- `packages/cli`: host I/O and orchestration through core APIs.
- `tests`: integration and core tests using Node's built-in test runner.

The BASIC core runs through one shared pipeline; later milestones extend fidelity
and tooling on the same model. Dependency direction is source → syntax →
semantic → encoding, where an arrow means the
right-hand layer may consume the left-hand layer. TAP handles bytes independently
of grammar. CLI depends on core; core never depends on CLI or VS Code. Core is
compiled without ambient Node/browser types, and lint rejects editor/CLI, Node
built-ins, and reverse layer imports there. Future language-service and emulator
adapters sit outside the parser/encoder pipeline.

TypeScript 6.0.3 is pinned within the supported range of TypeScript ESLint 8.71.2.
The toolchain uses no runtime framework dependencies.
