# ZXCode

**1982 BASIC. 2026 developer experience.**

ZXCode is a modern development environment for authentic Sinclair ZX Spectrum 48K BASIC.

The goal is deliberately conservative about the language and ambitious about the tooling: write real line-numbered Sinclair BASIC, while getting the editor experience expected from a modern IDE.

Start with the **[build, use and test handbook](docs/guides/handbook.md)** for
installation, CLI workflows, editor commands, emulator/debugger setup and testing.
For a short editor walkthrough, see [your first program](docs/guides/getting-started.md).

## Direction

ZXCode provides:

- syntax highlighting and live diagnostics;
- ZX Spectrum 48K BASIC compatibility checking;
- context-aware completion and Tab completion;
- hover documentation and navigation for line references;
- deterministic conversion of textual BASIC into authentic tokenized Spectrum BASIC;
- TAP generation;
- one-command launch in an emulator.

The language itself is not modernized. IDE features live around Sinclair BASIC rather than extending it.

## Status

M1–M8 are implemented: the shared compiler and CLI, VS Code editing/refactoring,
TAP import and round trips, Fuse Run, and the supported original-ROM BASIC debugger.
The debugger includes source breakpoints, paused inspection, screen snapshots,
read-only watches and statement Step Into; its optional emulator requirements and
supported boundaries are documented in the [handbook](docs/guides/handbook.md#6-debug-basic).

The host-independent core parses,
validates and encodes all fifty original 48K ROM command grammars, expressions,
numeric/string variables and arrays, slicing, control flow, PRINT/INPUT,
DATA/READ/RESTORE, DEF FN/FN, REM, and listing/cassette forms. The CLI checks source
and builds TAP files through that same model, retaining source maps and categorized
diagnostics. The editor-independent language-service contract and versioned
`createDocumentSession` analysis snapshots are implemented. `documentDiagnostics`
returns cached, versioned shared diagnostics including encoder limits. Semantic
symbol indexing, hover, definitions and references use the same canonical model;
parser-context completion uses checked text edits and typed candidates. The VS Code
extension consumes those same snapshots. Shared original-manual help covers every ROM token, and
`documentSignatureHelp` supplies typed built-in/FN argument information, and
`documentSymbols` exposes an immutable outline in physical source order.
See the [service contract](docs/design/032-language-service-contract.md) and
[M4 headless acceptance gate](docs/design/037-m4-headless-acceptance.md).

The [M2 acceptance corpus](docs/design/026-m2-core-acceptance.md) covers all commands
and built-in signatures with independent byte fixtures. A combined arrays, DATA,
functions and channels program loads/runs in the original ROM, displays `CORE OK`,
and returns `0 OK, 100:1`. M1's hello bytes and load/run acceptance remain intact.

Decimal conversion reproduces original-ROM storage and rounding; see the
[numeric contract](docs/design/020-numeric-literals.md). M3 numeric lexical hardening now includes the ROM’s contextual fraction/exponent
whitespace rules. The shared 256-byte Spectrum character map is implemented; controls, graphics/UDG
notation and named/raw text escapes are active in quoted strings and REM tails. Control packets now have checked internal
encoding and lossless text-byte decoding, including truncated-packet diagnostics.
The core also exposes `readTapBlocks` and `readBasicTap`, with strict length,
checksum and BASIC metadata validation and structured byte-offset failures.
The experimental `decodeBasicProgram`, `exportBasicSource` and `inspectBasicTap`
APIs retain raw bytes and saved variables. Source export reports exact success
only after recompilation reproduces the original BASIC image; see the
[import feasibility contract](docs/design/029-import-feasibility.md).
The product `zxcode import input.tap` command creates verified editable source
and a provenance report, refusing unsupported input and existing output paths.
Saved variables require explicit `--source-only` consent; see the
[TAP import guide](docs/guides/import-tap.md).
Container names and payloads remain opaque bytes; see the
[TAP contract](docs/design/019-tap-container.md).
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

`npm run test:compatibility` checks the pinned 448-case independent M3 corpus.
Its deterministic report records exact export guarantees and known limits; see
the [corpus contract](docs/design/030-m3-compatibility-corpus.md).

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
| `npm run build` | Compile core, CLI and runner; bundle the VS Code extension and host-test harness |
| `npm run typecheck` | Check all workspaces and compile-time contract tests without emitting code |
| `npm run lint` | Run ESLint with zero warnings allowed |
| `npm test` | Build and run Node's test runner |
| `npm run check` | Run type checking, lint, build, and tests |
| `npm run test:compatibility` | Check the pinned independent M3 corpus |
| `npm run test:service` | Sweep all headless query positions and report behavior |
| `npm run test:extension` | Run an isolated real VS Code development-host smoke |
| `npm run test:roundtrip` | Verify supported semantic TAP/source round trips |
| `npm run package:extension` | Build an installable VSIX under `artifacts/` |
| `npm run test:vsix` | Verify reproducibility and test the actual installed VSIX |
| `npm run test:existing -- --output ABSOLUTE_EMPTY_DIRECTORY` | Capture the installed import/edit/build workflow |
| `npm run test:run -- --fuse ABSOLUTE_FUSE_EXECUTABLE` | Run optional real Fuse/editor acceptance |
| `npm run clean` | Remove generated build outputs |
| `npm run zxcode -- --help` | Run the compiled CLI (build first) |

CI uses the same install/check commands on Node.js 24 on Linux, macOS and Windows,
then compares and retains the deterministic M3 compatibility report. See the
[M3 acceptance gate](docs/design/031-m3-fidelity-acceptance.md). Dependency versions are
locked in `package-lock.json`; generated output is ignored by Git. CI also compares
headless M4 reports across platforms and boots an isolated Linux extension host.

## Implementation layout

The repository has four private workspaces. Core and CLI use native ES modules;
the extension bundles CommonJS for the desktop editor host:

- `packages/core/src/source`: source identity/ranges and diagnostics.
- `packages/core/src/syntax`: physical lines, lexer, recoverable CST, and parser.
- `packages/core/src/semantic`: analysis and validated build model.
- `packages/core/src/encoding`: Spectrum numeric/program bytes and source maps.
- `packages/core/src/decoding`: independent text-byte packet decoding.
- `packages/core/src/tap`: container writing from bytes and explicit metadata.
- `packages/extension`: VS Code document/lifecycle/range adapter and isolated host tests.
- `packages/cli`: host I/O and orchestration through core APIs.
- `packages/runner`: editor-independent emulator/process ownership, Fuse Run and optional ZRCP machine control.
- `tests`: integration and core tests using Node's built-in test runner.

The BASIC core runs through one shared pipeline for all frontends. Dependency direction is source → syntax →
semantic → encoding, where an arrow means the
right-hand layer may consume the left-hand layer. TAP handles bytes independently
of grammar. CLI depends on core; core never depends on CLI or VS Code. Core is
compiled without ambient Node/browser types, and lint rejects editor/CLI, Node
built-ins, and reverse layer imports there. Language-service queries and emulator
adapters sit outside the parser/encoder pipeline.

TypeScript 6.0.3 is pinned within the supported range of TypeScript ESLint 8.71.2.
The toolchain uses no runtime framework dependencies.

The extension development scaffold targets VS Code 1.140.0; see its
[development notes](packages/extension/README.md). The registered ZX Spectrum BASIC language highlights `.zxbas` automatically;
generic `.bas` uses explicit or workspace language selection. Problems, completion, hover, navigation, references, outline and build/check
commands share the core language model. Follow the [getting-started guide](docs/guides/getting-started.md)
with [the sample](examples/getting-started.zxbas) to build your first TAP.

The optional [debug-machine backend guide](docs/guides/debug-machine-setup.md)
describes separately installed ZRCP machine control, capability negotiation and
owned/attached lifecycle. BASIC source debugging remains above that machine API;
normal Fuse Run is independent.
