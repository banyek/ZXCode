# ZXCode: build, use and test

ZXCode provides tooling for original Sinclair ZX Spectrum 48K ROM BASIC. Source
programs use real BASIC line numbers; labels, implicit numbering and other BASIC
dialects are not supported. The compiler, CLI and editor share one language model.

Use this handbook for the complete workflow. For a short editor walkthrough, start
with [your first program](getting-started.md).

## 1. Requirements

| What you want to do | Requirements |
| --- | --- |
| Build from source, use the CLI, run ordinary tests | Git, Node.js **24.x**, npm |
| Use the editor extension | VS Code **1.140.0 or newer**, and a built VSIX or development checkout |
| Run a program automatically | A separately installed Fuse CLI, version 1.8 or later |
| Debug BASIC | A separately built ZEsarUX 13.0 with ZXCode's loopback capability option, original 48K ROM, and a Unix extension host |
| Run native editor tests | A desktop session, or Xvfb on headless Linux; the harness downloads pinned VS Code 1.140.0 unless an executable is supplied |

Node 25 is outside the supported range. The repository's `.nvmrc` selects Node 24;
if you use nvm on macOS/Linux, run `nvm install` and `nvm use` in the checkout.
On Windows, select Node 24 with your usual installer/version manager before
running the npm commands below.

The extension bundles its runtime code: installing a VSIX does not require npm or
building the repository. Emulators and ROMs are not bundled. Ordinary compiler,
compatibility and language-service tests need neither an emulator nor a ROM.

## 2. Clone and build

Run commands from the repository root. A private repository requires authenticated
GitHub access when cloning.

```sh
git clone https://github.com/banyek/ZXCode.git
cd ZXCode
node --version
npm ci
npm run build
npm run zxcode -- --help
```

`node --version` should print `v24.x`. `npm ci` installs the locked dependencies
and workspace links. `npm run build` compiles core, CLI and runner, and bundles the
extension and native test harness. Generated code lives under package `dist/`
directories; the CLI must be built before use.

Create a directory for the walkthrough outputs. On macOS/Linux:

```sh
mkdir -p artifacts/demo
```

Or in Windows PowerShell:

```powershell
New-Item -ItemType Directory -Force artifacts/demo
```

`artifacts/` is ignored by Git. CLI builds do not create missing parent directories.

## 3. Use the CLI

### Check and build a program

```sh
npm run zxcode -- check examples/hello.bas
npm run zxcode -- build examples/hello.bas --output artifacts/demo/hello.tap --name HELLO --autostart 10
```

The second command creates an autostarting tape. Open it in a Spectrum 48K emulator
and load it with `LOAD ""`. Without `--autostart`, enter `RUN` after loading.
`check` produces diagnostics but writes no tape.

| Build option | Meaning |
| --- | --- |
| `--output path` or `-o path` | Destination TAP; default is beside the source with a `.tap` extension |
| `--name HELLO` | Spectrum cassette filename, 1–10 directly representable characters; default is the source basename |
| `--autostart 10` | BASIC startup line, 1–9999; default is no autostart |

Long basenames, such as `getting-started`, need a shorter `--name` when using the
CLI. A successful build replaces its destination TAP. Fatal diagnostics preserve
previous output; source files and their filesystem aliases cannot be destinations.

Use UTF-8 source. A minimal program looks like this:

```basic
10 PRINT "HELLO SPECTRUM"
20 STOP
```

Errors block a build. Semantic warnings and editor hints have separate severities;
read the diagnostic category and message rather than treating every diagnostic as
a syntax failure. Exit codes are `0` for success, `1` for source/build/I/O failure,
and `2` for invalid CLI usage. `npm run zxcode -- --help` lists the supported CLI
commands: `check`, `build`, `import` and `rebuild`.

### Import and preserve an existing TAP

After the build example above:

```sh
npm run zxcode -- import artifacts/demo/hello.tap --output artifacts/demo/imported.zxbas
npm run zxcode -- check artifacts/demo/imported.zxbas
npm run zxcode -- rebuild artifacts/demo/imported.zxbas --reference artifacts/demo/hello.tap --output artifacts/demo/preserved.tap
```

Import creates the source and `imported.zxbas.import.json` provenance report. Both
paths must be new. Rebuild also requires a new output path, so choose different
names when repeating this walkthrough.

Import accepts a supported BASIC header/data pair only when recompilation proves
the stored BASIC bytes identical. Saved variables block import by default. Use
`--source-only` explicitly to omit them; that does not restore saved runtime state
when the source runs. Unsupported input is reported rather than approximated.

`rebuild` requires the original tape and identical compiled BASIC bytes. It
preserves cassette metadata and opaque saved-variable bytes, and verifies the
entire TAP. Use ordinary `build` after edits that change the BASIC image. See the
[import and preservation guide](import-tap.md) for guarantees and restrictions.

## 4. Install or develop the VS Code extension

### Install a VSIX

```sh
npm run package:extension
```

The package is written to `artifacts/zxcode-vscode-0.0.0.vsix`, with the version
taken from the extension manifest. In VS Code, run **Extensions: Install from
VSIX**, select that file and reload if prompted. Packaging does not publish to
Marketplace. You can copy the VSIX to another compatible VS Code installation.

Open a `.zxbas` file, for example `examples/getting-started.zxbas`. Its language
mode should be **ZX Spectrum BASIC**. Generic `.bas` files are opt-in: choose the
language mode or add this to that workspace's settings:

```json
{
  "files.associations": { "*.bas": "zx-spectrum-basic" }
}
```

The ZXCode repository already includes that association in its own
`.vscode/settings.json`; it does not change other workspaces globally.

### Develop the extension

Open the repository in VS Code after `npm ci`, then press F5 and select
**ZXCode Extension Development Host**. The launch configuration invokes the npm
build task. Test BASIC editing in the new window. After source changes, rebuild
and restart the development host. The language core stays independent of VS Code.

### Everyday editor commands

Open the Command Palette and search for `ZXCode`:

| Action | How to use it |
| --- | --- |
| Check source | **ZXCode: Check BASIC**; inspect Problems and ZXCode Output |
| Build a tape | **ZXCode: Build TAP**; compiles current unsaved text |
| Complete code | Ctrl+Space and normal suggestion acceptance with Tab |
| Navigate | Hover, Go to Definition, Find All References and Outline |
| Discover programs | Workspace symbol search and **ZXCode: Open BASIC Program** |
| Format | VS Code's **Format Document**; changes require identical compiled BASIC bytes |
| Renumber | **ZXCode: Preview Renumber BASIC**, inspect the diff, then **ZXCode: Apply Renumber** |
| Fix a missing header separator | Use the offered quick fix, such as `10PRINT 1` → `10 PRINT 1` |

Renumber input is `start,step,first old line,last old line`, defaulting to
`10,10,1,9999`. It preserves proven line destinations and blocks unsafe computed
targets, collisions and order crossings. Editing the source invalidates a preview.
Formatting preserves strings, REM tails, numeric spelling, case and line endings.

Each BASIC file is an independent program. Workspace navigation uses unsaved
buffers where available; it never links line numbers or variables across files.

## 5. Build TAP versus Run Spectrum

| Operation | Tape behavior | Emulator |
| --- | --- | --- |
| CLI `build` | Chosen/sibling output; explicit name and autostart options | Open manually |
| Editor **Build TAP** | Sibling/configured output; header name ZXCODE, no autostart | Open manually, then `RUN` |
| Editor **Run Spectrum** | Private temporary TAP, autostarts at the lowest BASIC line | Launches Fuse and owns its process |

For Run, install a Fuse CLI separately and trust your workspace. Leave the path
empty for PATH discovery, or configure an actual executable, not an app directory:

```json
{
  "zxcode.emulator.executable": "/absolute/path/to/fuse",
  "zxcode.emulator.configurationFormat": "auto"
}
```

Choose **ZXCode: Run Spectrum**, then **ZXCode: Stop Spectrum** to stop the owned
process and clean its private tape. A valid repeated Run replaces the old session;
a source error leaves an existing run alive. Normal Build TAP output is independent.
Use ZXCode Output for executable, startup and settings errors.

Other useful settings:

| Setting | Default / supported values |
| --- | --- |
| `zxcode.build.outputDirectory` | `""` for sibling TAPs; or a source-relative directory such as `artifacts/tapes`, without absolute paths or dot segments |
| `zxcode.target.profile` | `spectrum-48k` |
| `zxcode.emulator.backend` | `fuse` |
| `zxcode.emulator.configurationFormat` | `auto`, `xml`, `ini`; auto uses XML on Unix and INI on Windows |
| `zxcode.debug.executable` | Absolute optional loopback-capable ZEsarUX executable |

Executable settings apply on the extension host, including remote workspaces.
Real Fuse execution has been reproduced on macOS; native Windows Fuse execution
is not yet verified. See the [Run Spectrum guide](run-spectrum.md).

## 6. Debug BASIC

Normal Run uses Fuse. Source debugging uses a separately installed **ZEsarUX 13.0
build with the real `--remoteprotocol-loopback-only` option**. Stock 13.0 is
refused. Follow the [debug backend setup guide](debug-machine-setup.md) for the
pinned source, optional patch and machine API. Owned launch currently supports
Unix hosts; Windows owned debug launch is not advertised.

Set `zxcode.debug.executable`, open a saved local `.zxbas` file in a trusted
workspace, and choose **ZXCode: Debug Spectrum BASIC**. Unsaved edits in that
saved file are compiled. Alternatively, add this launch configuration to your
BASIC workspace's `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug Spectrum BASIC",
      "type": "zxcode-basic",
      "request": "launch",
      "program": "${file}",
      "stopOnEntry": true
    }
  ]
}
```

Use `examples/debug/runtime-dispatch.zxbas` for control flow and
`examples/debug/runtime-variables.zxbas` for variables/arrays.

| Debug action | Meaning |
| --- | --- |
| Breakpoint | Stop at a verified BASIC line/statement; column breakpoints can select colon/IF-tail commands |
| Continue / Pause | Resume or pause the owned machine; pauses between BASIC dispatches may have no source frame |
| Step Into | Stop at the next verified BASIC dispatch, including executed IF tails, loops and GO SUB/RETURN |
| Variables | Read stored numeric/string scalars, arrays and FOR state while paused |
| Watch | Read a variable name or numeric array element such as `total`, `s$`, `i`, `n(2,1)` |
| **ZXCode: View Memory** | Open a read-only paused memory snapshot |
| **ZXCode: Show Spectrum Screen** | Capture/refresh paused display memory; select either static flash phase |
| **ZXCode: Reset BASIC Debug Session** | Close the old machine and cold-launch the current source at entry, clearing runtime variables |

Array watch indices must be positive decimal integer literals. Watches do not
execute arithmetic, functions or string slices. Numeric displays show exact stored
values, which can differ from rounded ROM `PRINT` output. Retained memory/screen
snapshots are historical after resume or termination.

Step Over, Step Out, conditional/log breakpoints, arbitrary expression evaluation,
alternate ROMs and exact mapping of runtime-modified BASIC/FN slots are unsupported.
Source edits or close/reopen invalidate the session; restart to rebuild. A ROM
report ends execution rather than generating a guessed final source location.

## 7. Test and validate changes

For normal development:

```sh
npm run check
npm run test:compatibility
npm run test:service
npm run test:roundtrip
```

| Command | Coverage / prerequisites |
| --- | --- |
| `npm run typecheck` | All workspaces and compile-time contracts; no emission |
| `npm run lint` | ESLint; warnings fail the command |
| `npm test` | Builds, then runs `tests/*.test.mjs` with Node's test runner |
| `npm run check` | Type checking, lint, build and ordinary tests |
| `npm run test:compatibility` | Pinned independent compatibility corpus |
| `npm run test:service` | Headless language-service query sweep |
| `npm run test:roundtrip` | Supported semantic TAP/source round trips |
| `npm run test:extension` | Pinned real VS Code development-host smoke test |
| `npm run package:extension` | Build the VSIX and payload hash manifest |
| `node scripts/verify-extension-package.mjs` | After packaging: verify reproducible VSIX bytes and bundled payload |
| `npm run test:vsix` | Package, verify, install into a temporary profile and test the actual VSIX |
| `npm run test:existing -- --output ABSOLUTE_EMPTY_DIRECTORY` | Retain evidence for the installed import/edit/build workflow; no emulator required |
| `npm run test:run -- --fuse ABSOLUTE_FUSE_EXECUTABLE` | Optional real Fuse/editor acceptance; see the run guide for capture/ROM options |
| `npm run clean` | Clean generated TypeScript and extension-bundle outputs |

Ordinary tests use private process fixtures and local loopback protocol servers,
not real emulators. Allow loopback networking in a sandboxed test environment.
Native editor tests need a display and may download VS Code on first use. On
headless Linux, run:

```sh
xvfb-run -a npm run test:extension
xvfb-run -a npm run test:vsix
```

The harness uses temporary user/extension profiles. To reuse a compatible local
VS Code executable, set `ZXCODE_VSCODE_EXECUTABLE`; leave it unset for the pinned
download. Native tests do not install ZXCode into your normal editor profile.

For a focused test after building:

```sh
npm run build
node --test tests/renumber.test.mjs
```

Compatibility fixtures are contracts, not snapshots to regenerate after a failure.
Establish original-ROM behavior or independent provenance before changing expected
bytes. See [design documents](../design/) and [retained evidence](../evidence/).

## 8. Optional real-emulator acceptance

These checks are separate from ordinary CI. Obtain the documented emulator/ROM
prerequisites first; automation reports do not imply a manual desktop visual check.

For native debugger checks on a Unix host, create `artifacts/debug-evidence`, then
use this macOS/Linux shell command:

```sh
ZXCODE_TEST_ZESARUX=/absolute/path/to/loopback-capable/zesarux \
ZXCODE_TEST_DEBUG_EVIDENCE="$PWD/artifacts/debug-evidence" \
npm run test:vsix
```

On headless Linux, prefix the final npm command with `xvfb-run -a`.
The native reports record source frames, variables, memory, stepping and cold
reset. For a separate machine/coordinator test, after building:

```sh
node scripts/research/verify-basic-stepping.mjs \
  --executable /absolute/path/to/loopback-capable/zesarux \
  --output-dir "$PWD/artifacts/new-stepping-evidence"
```

That output path must be new: do not pre-create `new-stepping-evidence`. The probe
compares 17 dispatches with the independent original-ROM trace, and checks
inspection, breakpoint/step/continue behavior and a fresh-machine cold reset.

For Fuse plus original-ROM pixel capture, follow the exact `test:run` invocation
in the [run guide](run-spectrum.md#reproduce-the-editoremulator-acceptance). For
TAP import/edit/run evidence, see [M7 acceptance](../design/060-m7-existing-program-acceptance.md).
Older Python research probes have their own pinned SkoolKit/reference-tool and ROM
requirements; they are not prerequisites for `npm run check`.

## 9. Development layout and CI

| Location | Responsibility |
| --- | --- |
| `packages/core` | Source model, parser, diagnostics, encoder/TAP APIs, language service, transforms and pure runtime decoders |
| `packages/cli` | Filesystem/argument handling through core APIs |
| `packages/runner` | Emulator ownership, build/run orchestration, ZRCP and BASIC debug coordination |
| `packages/extension` | VS Code adapters, commands, native debug UI and host tests |
| `tests/fixtures` | Compatibility references and process/protocol test fixtures |
| `scripts/compatibility` | Corpus, service and round-trip validation/reporting |
| `scripts/research` | Optional original-ROM/emulator research and reproduction probes |
| `docs/design`, `docs/evidence` | Decisions, supported boundaries and their evidence |

Edit source, run the relevant focused tests, then run `npm run check`. For language
changes, also run compatibility/service/round-trip checks. For editor changes,
exercise the development host and actual VSIX. Keep parsing, acceptance and build
behavior aligned through the shared core; do not put editor APIs in it.

[CI](../../.github/workflows/ci.yml) runs Node 24 checks and packaging on Linux,
macOS and Windows, compares language-service/package reports across platforms,
and runs native development-host and installed-VSIX tests on Linux with Xvfb.
Real Fuse/ZEsarUX/ROM acceptance is opt-in. An Actions billing restriction can
refuse a job before any test steps run; that is distinct from a failing test.

## 10. Troubleshooting

| Symptom | What to check |
| --- | --- |
| Node engine/version error | Use Node 24, reopen the terminal if needed, then run `npm ci` |
| CLI cannot load compiled code | Run `npm run build` from the repository root |
| CLI filename is too long | Supply `--name` with 1–10 Spectrum characters |
| Output directory is missing | Create it before a CLI build/import/rebuild |
| `.bas` has no ZXCode features | Choose ZX Spectrum BASIC mode or opt in with `files.associations` |
| TAP does not start after loading | Normal builds default to no autostart; enter `RUN` or build with `--autostart` |
| Run cannot find Fuse | Use an absolute CLI executable path and inspect ZXCode Output; trust the workspace |
| Debugger rejects stock ZEsarUX | Use the documented 13.0 build with the real loopback capability option |
| No source frame / stale debug mapping | Pause at a verified dispatch; rebuild/restart after source or program-image changes |
| Import/rebuild refuses a tape | Read the reported guarantee failure; keep the original and choose new output paths |
| Linux native test has no display | Use Xvfb as shown above |
| GitHub jobs fail instantly | Inspect annotations and whether steps started; check account billing/budgets for an Actions restriction |

## Further guides

- [First editor program](getting-started.md)
- [Import and preserve TAP files](import-tap.md)
- [Run Spectrum and Fuse acceptance](run-spectrum.md)
- [Optional debug backend setup](debug-machine-setup.md)
- [Extension development notes](../../packages/extension/README.md)
- [BASIC stepping contract and acceptance evidence](../design/069-basic-stepping-acceptance.md)
