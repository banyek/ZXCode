# First Spectrum BASIC program in ZXCode

ZXCode uses original ZX Spectrum 48K ROM BASIC: every program line needs a real
line number. Editor conveniences do not add labels or a new BASIC dialect.

1. Open the ZXCode repository in VS Code. With Node 24, run `npm ci` and
   `npm run build`, then press F5 and choose **ZXCode Extension Development Host**.
2. In that window, open `examples/getting-started.zxbas`. The status bar should say
   **ZX Spectrum BASIC**. `.zxbas` selects the language automatically; for another
   `.bas` file, choose that language mode explicitly.
3. Hover over `PRINT` for Sinclair syntax/help. Cmd/Ctrl-click the `40` in
   `GO TO 40` to jump to its line. Use Find All References on `count` and open the
   Outline to see numbered lines and definitions.
4. On a new numbered line, type `70 PR`, press Ctrl+Space and accept `PRINT` with
   Tab using VS Code's normal suggestion widget. Undo this practice edit. Try
   `70 PRINT AT 10,` to see a syntax error in Problems, then remove that line.
5. Run **ZXCode: Check BASIC** from the command palette. Then run **ZXCode: Build
   TAP**. ZXCode Output should report `getting-started.tap` beside the sample.
   Commands use the current editor buffer, so unsaved changes are included.

The sample draws a border, prints a heading, defines a variable and loops through
three values. Its line 50 jump is intentional: navigation uses real BASIC line
numbers. The generated TAP has header name ZXCODE and no autostart line; after
loading it on a Spectrum, enter `RUN`. For one-action execution with a separately installed emulator, follow the
[Run Spectrum guide](run-spectrum.md).

To collect TAPs in a subdirectory, set this in the workspace's VS Code settings:

```json
{
  "zxcode.build.outputDirectory": "artifacts/tapes",
  "zxcode.target.profile": "spectrum-48k"
}
```

The output directory is relative to each source file. Leave it empty for sibling
output. Use ordinary directory names without absolute paths or dot segments.
Only original 48K ROM BASIC is currently offered as a target. Diagnostics and
builds share the same compiler; invalid source creates no new TAP and preserves
previous output. Read ZXCode Output for filesystem/settings errors and Problems
for source diagnostics.

Generic `.bas` associations remain opt-in. To select ZX Spectrum BASIC for all
`.bas` files in this workspace, add
`"files.associations": {"*.bas": "zx-spectrum-basic"}` to workspace settings.
