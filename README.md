# ZXCode

**1982 BASIC. 2026 developer experience.**

Write authentic Sinclair ZX Spectrum 48K BASIC in VS Code, check it as you type,
and build `.tap` files for a Spectrum or emulator.

[Download the latest release](https://github.com/banyek/ZXCode/releases/latest) ·
[User guides](docs/README.md) ·
[Report an issue](https://github.com/banyek/ZXCode/issues)

## Install

Requires **VS Code 1.140.0 or newer**. Node.js and npm are not needed to use the
released extension.

1. Download the `.vsix` file from the [latest GitHub Release](https://github.com/banyek/ZXCode/releases/latest).
2. In VS Code, open the Command Palette and choose **Extensions: Install from VSIX...**.
3. Select the downloaded file and reload VS Code if prompted.

Or install the downloaded package from a terminal:

```sh
code --install-extension zxcode-vscode-0.1.0.vsix
```

Use the filename of the version you downloaded. Releases also include a
`.vsix.json` payload report with its SHA-256 checksum. Distribution is through
GitHub Releases; ZXCode is not currently published to VS Code Marketplace.

## Write your first program

Create `hello.zxbas` and enter:

```basic
10 PRINT "HELLO SPECTRUM"
20 STOP
```

The language mode should say **ZX Spectrum BASIC**. `.zxbas` files select it
automatically; for a generic `.bas` file, choose the language mode explicitly.

- Run **ZXCode: Check BASIC** from the Command Palette and inspect **Problems**.
- Run **ZXCode: Build TAP** to create `hello.tap` beside your saved source.
- Load the tape in a Spectrum 48K emulator with `LOAD ""`, then enter `RUN`.

Build and check use your current editor text, including unsaved edits. For a
longer walkthrough with completion and navigation, see
[your first Spectrum BASIC program](docs/guides/getting-started.md).

## What you can do

- Edit with syntax highlighting, live diagnostics, completion and Sinclair help.
- Navigate BASIC lines, variables and functions with definitions, references and Outline.
- Build TAPs, format source and preview safe line renumbering.
- Import supported BASIC TAPs with byte-preservation checks.
- Run programs directly with a separately installed **Fuse 1.8+** emulator.
- Debug with breakpoints, Step Into, variables, watches and screen/memory inspection
  using the optional [ZEsarUX setup](docs/guides/debug-machine-setup.md).

Programs use real BASIC line numbers and original 48K ROM BASIC. `GOTO` and
`GOSUB` are accepted as source aliases for canonical `GO TO` and `GO SUB`.
ZXCode does not add labels, implicit line numbering or a new BASIC dialect.
Emulators and ROMs are not bundled; they are unnecessary for editing, checking
and building TAPs.

## Guides

| Task | Guide |
| --- | --- |
| Editor commands, settings, CLI and troubleshooting | [User handbook](docs/guides/handbook.md) |
| Build and launch with Fuse | [Run Spectrum](docs/guides/run-spectrum.md) |
| Import and preserve an existing TAP | [TAP import](docs/guides/import-tap.md) |
| Configure the optional debugger | [Debug-machine setup](docs/guides/debug-machine-setup.md) |
| Try working BASIC programs | [Examples](examples/) |

## Use the CLI from source

Requires **Node.js 24.x**, npm and Git. This public repository can be cloned
without GitHub authentication:

```sh
git clone https://github.com/banyek/ZXCode.git
cd ZXCode
npm ci
npm run build
npm run zxcode -- check examples/hello.bas
npm run zxcode -- build examples/hello.bas --autostart 10
```

The build writes `examples/hello.tap`. See the
[CLI guide](docs/guides/handbook.md#3-use-the-cli) for output paths, cassette names,
import and preservation commands.

## Contribute

Bug reports and contributions are welcome through
[GitHub Issues](https://github.com/banyek/ZXCode/issues) and pull requests.
Build/test commands, architecture and compatibility references live in the
[development guide](docs/development.md). Maintainers can follow the
[release procedure](docs/releases.md). Browse [all documentation](docs/README.md)
for design documents and historical implementation specifications.
