# Developing ZXCode

Build and test instructions for contributors. For installation and everyday use,
start with the [project README](../README.md) or [user guides](README.md).
Follow the repository [engineering rules](../AGENTS.md).

## Build and test

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

PRs run cached Ubuntu validation with `npm run check`. Code pushes to `main`
and manual CI runs additionally validate Linux, macOS and Windows, package the
extension, check CLI invocations, retain compatibility/language-service reports,
compare platform parity and run both native VS Code smoke modes. Documentation-only
changes skip automatic CI. Tagged releases use the separate [release workflow](releases.md).
Dependency versions are locked in `package-lock.json`; generated output is ignored.

For focused testing and optional emulator acceptance, see the
[handbook's validation guide](guides/handbook.md#7-test-and-validate-changes).

## VS Code development host

After `npm ci`, open the repository in VS Code and press F5 with
**ZXCode Extension Development Host**. Opening a `.zxbas` file activates ZXCode.
`npm run test:extension` builds and runs the pinned VS Code 1.140.0 development
host with isolated settings/extensions. On headless Linux, use
`xvfb-run -a npm run test:extension`. Set `ZXCODE_VSCODE_EXECUTABLE` to reuse a
compatible local installation.

`npm run package:extension` creates the VSIX and payload hash report under
`artifacts/`. `npm run test:vsix` verifies reproducibility and installs the package
into an isolated profile to test the actual editor workflow. See the
[packaging design](design/045-editor-package-acceptance.md).

## Implementation layout

The repository has four npm workspaces marked private to prevent accidental npm
publication; the GitHub repository is public. Core and CLI use native ES modules;
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
[extension usage guide](../packages/extension/README.md). The registered ZX Spectrum BASIC language highlights `.zxbas` automatically;
generic `.bas` uses explicit or workspace language selection. Problems, completion, hover, navigation, references, outline and build/check
commands share the core language model. Follow the [getting-started guide](guides/getting-started.md)
with [the sample](../examples/getting-started.zxbas) to build your first TAP.

The optional [debug-machine backend guide](guides/debug-machine-setup.md)
describes separately installed ZRCP machine control, capability negotiation and
owned/attached lifecycle. BASIC source debugging remains above that machine API;
normal Fuse Run is independent.

## Implementation status and compatibility references

M1–M8 are implemented: the shared compiler and CLI, VS Code editing/refactoring,
TAP import and round trips, Fuse Run, and the supported original-ROM BASIC debugger.
The debugger includes source breakpoints, paused inspection, screen snapshots,
read-only watches and statement Step Into; its optional emulator requirements and
supported boundaries are documented in the [handbook](guides/handbook.md#6-debug-basic).

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
See the [service contract](design/032-language-service-contract.md) and
[M4 headless acceptance gate](design/037-m4-headless-acceptance.md).

The [M2 acceptance corpus](design/026-m2-core-acceptance.md) covers all commands
and built-in signatures with independent byte fixtures. A combined arrays, DATA,
functions and channels program loads/runs in the original ROM, displays `CORE OK`,
and returns `0 OK, 100:1`. M1's hello bytes and load/run acceptance remain intact.

Decimal conversion reproduces original-ROM storage and rounding; see the
[numeric contract](design/020-numeric-literals.md). M3 numeric lexical hardening now includes the ROM’s contextual fraction/exponent
whitespace rules. The shared 256-byte Spectrum character map is implemented; controls, graphics/UDG
notation and named/raw text escapes are active in quoted strings and REM tails. Control packets now have checked internal
encoding and lossless text-byte decoding, including truncated-packet diagnostics.
The core also exposes `readTapBlocks` and `readBasicTap`, with strict length,
checksum and BASIC metadata validation and structured byte-offset failures.
The experimental `decodeBasicProgram`, `exportBasicSource` and `inspectBasicTap`
APIs retain raw bytes and saved variables. Source export reports exact success
only after recompilation reproduces the original BASIC image; see the
[import feasibility contract](design/029-import-feasibility.md).
The product `zxcode import input.tap` command creates verified editable source
and a provenance report, refusing unsupported input and existing output paths.
Saved variables require explicit `--source-only` consent; see the
[TAP import guide](guides/import-tap.md).
Container names and payloads remain opaque bytes; see the
[TAP contract](design/019-tap-container.md).
Printable literals include Spectrum £, © and ↑ alongside the existing ASCII
coverage (backtick is excluded); strings support doubled quotes and REM tails
retain literal source bytes. Production and normal CI require
neither an emulator nor a ROM.

CAT, FORMAT, MOVE and ERASE build with nonfatal runtime-capability warnings on the
default 48K target. OPEN # and CLOSE # support base-ROM channels. Explicit core
`targetProfile` options declare execution capabilities without changing grammar;
see the [capability policy](design/025-runtime-capability-policy.md).

Text escapes use `{INK 2}`, `{AT 1,2}`, `{TAB 258}`, `{UDG A}`, `{BLOCK 15}` and
`{BYTE 0xFF}`. Double literal braces as `{{` and `}}`; backslashes remain literal.
Byte 13 is supported in REM; quoted strings use ordinary `CHR$ 13` expressions.
See the [source escape contract](design/028-text-source-escapes.md) and
[working example](../examples/escapes.bas).

`npm run test:compatibility` checks the pinned 448-case independent M3 corpus.
Its deterministic report records exact export guarantees and known limits; see
the [corpus contract](design/030-m3-compatibility-corpus.md).

See [docs/design](design/).

