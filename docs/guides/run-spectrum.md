# Run Spectrum from VS Code

Install the ZXCode VSIX or use the source development host, then open a `.zxbas`
file. The [first-program guide](getting-started.md) covers source setup and editor
intelligence; `examples/getting-started.zxbas` is a small runnable sample.

1. Install a **Fuse CLI executable** separately from the
   [official project](https://fuse-emulator.sourceforge.net/). Use Fuse 1.8 or
   later; the reproduced reference is Fuse 1.10.0 with libspectrum 1.7.0. On macOS
   the tested backend is the SDL2/CLI build, with its installed ROM/data directory.
   An application directory or a file-association launcher is not an executable.
2. If the executable is on PATH, leave settings empty. Otherwise open VS Code
   Settings, find **ZXCode: Emulator Executable**, and enter its absolute path on
   the extension host. For example:

   ```json
   {"zxcode.emulator.executable": "/absolute/path/to/fuse"}
   ```

3. Open a trusted workspace and the sample, then choose **ZXCode: Run Spectrum**
   from the command palette, BASIC context menu or editor title Run button.
   ZXCode compiles the current buffer, writes a private TAP with the lowest BASIC
   line as autostart and launches Fuse in Spectrum 48K mode. No source save is
   required. The sample prints its heading and COUNT 1–3, then stops at line 60.
4. Choose **ZXCode: Stop Spectrum** to stop the owned emulator process and clean
   the private TAP. A valid repeated Run stops/replaces the earlier session.
   Syntax errors keep an already running session alive and appear in Problems.

ZXCode Output records source version, build identity, artifact path and process
failures. Startup progress can be cancelled; Stop also cancels pending startup.
The backend starts silently, disables exit confirmation/settings autosave and uses
private emulator configuration. Normal **Build TAP** still writes its configured
output with disabled autostart; Run never overwrites that file.

The default configuration format is XML for Unix CLI builds and INI for Windows.
If your Fuse build uses the other format, set
`"zxcode.emulator.configurationFormat": "xml"` or `"ini"`; `"auto"` restores the
platform default. The backend enum currently offers only `fuse`. Executable/format
settings are restricted and machine-overridable, so workspace trust is required.
For remote workspaces, the executable and temporary TAP live on the extension host.

For a missing or unrecognized emulator, inspect Output and configure a direct
executable path; ZXCode does not install it automatically. Native Windows Fuse
execution remains unverified on the current research host. Its path/configuration
conversion is covered separately from the real macOS SDL2 execution evidence.
If a distribution's CLI is unsuitable, use Build TAP, open the TAP manually in a
48K emulator, load it with `LOAD ""` and enter `RUN`. The
[selection record](https://github.com/banyek/ZXCode/blob/main/docs/design/047-first-external-emulator.md) includes the reproduced
source/build provenance and the independent captured screen.

## Reproduce the editor/emulator acceptance

With Node 24 and dependencies installed, use a separately built reference Fuse
1.10.0 SDL2 executable plus its null-UI automation build and original 48K ROM:

```sh
npm run test:run -- \
  --fuse /absolute/sdl2-prefix/bin/fuse \
  --headless-fuse /absolute/null-prefix/bin/fuse \
  --rom /absolute/null-prefix/share/fuse/48.rom \
  --output /absolute/empty/evidence
```

The output directory must be empty. The command builds/installs the actual VSIX in
a clean temporary profile, opens its packaged sample and uses native Run/Stop.
It retains the exact launched TAP/metadata and verifies source/image hashes and
map bounds. That same TAP runs for 500 frames in the reference original-ROM
capture backend and must match the reviewed screen pixels. `--hold-ms 1000..30000`
controls the bounded desktop inspection interval (default 10000). The automated
report does not claim a live desktop screenshot; inspect that window separately
when desktop access is available. Missing-emulator/build-error and cleanup paths
are also exercised. No user extension profile or emulator settings are changed.

The normal `npm run test:vsix` uses a private fixture executable and needs no Fuse
installation. Its result verifies the editor/process integration, while the
explicit reference command above verifies authentic sample execution as well.

While paused in a ZXCode BASIC debug session, use **ZXCode: Show Spectrum Screen** to view or refresh the 256×192 display. The view reads the bitmap and attributes together through the debug API. The Flash phase selector shows either static attribute phase. Retained pixels are labelled historical after execution resumes or the session ends; pause and refresh to capture new pixels.

Native Watch entries support numeric/string variable names, FOR current values, and numeric array elements with positive decimal integer indices, such as `total`, `s$`, and `n(2,1)`. Values describe stored machine numbers exactly. Arithmetic, functions and string slicing are explicitly unavailable; watch inspection never executes BASIC. Raw memory and variable scopes remain available separately.
