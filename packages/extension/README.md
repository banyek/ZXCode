# ZXCode: original Spectrum BASIC in VS Code

Install the generated `.vsix` with **Extensions: Install from VSIX**. Open a
`.zxbas` file, or choose **ZX Spectrum BASIC** as the language mode. Use Ctrl+Space
and normal Tab acceptance for suggestions, hover for Sinclair help, Cmd/Ctrl-click
for definitions and **ZXCode: Check BASIC** / **ZXCode: Build TAP** from the palette.

Follow the [getting-started guide](https://github.com/banyek/ZXCode/blob/main/docs/guides/getting-started.md)
and [sample](https://github.com/banyek/ZXCode/blob/main/examples/getting-started.zxbas).
The package also includes `getting-started.md` and `examples/getting-started.zxbas`.
For an installed VSIX, save a copy of the sample in your workspace and begin at
step 3 of the guide; its first two steps describe source development.

This workspace adapts VS Code documents to the shared ZX Spectrum BASIC core.
The registered **ZX Spectrum BASIC** language selects `.zxbas` files automatically.
For generic `.bas` files, choose the language mode or opt in per workspace:

```json
{"files.associations": {"*.bas": "zx-spectrum-basic"}}
```

Generic `.bas` is not claimed globally. Highlighting is visual; shared core
diagnostics remain authoritative. Problems update on open/edit and clear when a
document closes or leaves this language. Completion uses shared context, typed candidates and authentic BASIC text. Use
Ctrl+Space to request suggestions and normal VS Code Tab acceptance. No custom
keybindings or global suggestion settings are installed. Hover, Go to Definition (Cmd/Ctrl-click), Find All References and the document
outline use the same shared model for line numbers, variables and FN symbols.

From the repository root, use Node 24, run `npm ci` and `npm run check`, then use
F5 with **ZXCode Extension Development Host**. Opening a document in the registered language activates the extension.

`npm run test:extension` builds and runs the pinned VS Code 1.140.0 development
host with isolated settings/extensions. On Linux use `xvfb-run -a npm run
test:extension`. To reuse a local installation, set `ZXCODE_VSCODE_EXECUTABLE` to
its executable. The smoke verifies activation, document versions, shared queries,
Unicode/CRLF range conversion and stale-result rejection.

Use **ZXCode: Check BASIC** or **ZXCode: Build TAP** from the command palette or
BASIC editor context menu. Commands compile current unsaved text. Build writes a
sibling `.tap` for saved sources, or asks for an output location for untitled
source. ZXCode Output reports diagnostics and the full generated TAP URI; Problems
continues to show shared diagnostics. The initial TAP header name is ZXCODE and
autostart is disabled. Failed builds preserve existing output.

Native resource settings: `zxcode.build.outputDirectory` defaults to `""` (beside
source), or a relative subdirectory such as `artifacts/tapes`. Absolute paths and
dot segments are rejected; an explicit command destination overrides it.
`zxcode.target.profile` defaults to the sole supported `spectrum-48k` profile.
No project DSL or alternate BASIC syntax is introduced. Use **ZXCode: Run Spectrum** to build an autostarting private TAP and launch
a separately installed Fuse CLI. **ZXCode: Stop Spectrum** stops it and removes
that private TAP. The editor title also offers Run/Stop actions.

From source, `npm run package:extension` creates the installable VSIX and payload
hash manifest under `artifacts/`. `npm run test:vsix` checks reproducible bytes and
installs it in a temporary profile to verify the full editor workflow. This does
not publish the extension to Marketplace.

Run settings: `zxcode.emulator.executable` defaults to PATH discovery; use an
absolute Fuse executable path when needed. `zxcode.emulator.backend` is `fuse`.
`zxcode.emulator.configurationFormat` is `auto`, or explicitly `xml`/`ini` for the
installed build. Run requires workspace trust and Fuse 1.8 or later (1.10.0 is the
reproduced reference). Failed source keeps an existing run alive; a valid repeat
stops/replaces it. Run uses current unsaved text and a private TAP with autostart;
normal Build TAP output/settings are independent. See the repository's
[Run Spectrum guide](https://github.com/banyek/ZXCode/blob/main/docs/guides/run-spectrum.md).

Use **ZXCode: Preview Renumber BASIC** for a read-only diff. Enter start, step,
first old line and last old line (defaults `10,10,1,9999`), then run
**ZXCode: Apply Renumber** to accept the complete plan. Edits invalidate a preview.
The transform preserves stored order and proven literal line destinations,
including GO TO, GO SUB, RUN, RESTORE, LIST/LLIST and SAVE LINE. It blocks computed
targets, collisions and order crossings. Other numeric values, strings and REM
contents stay unchanged. Programs inspecting their own source or RAM, or modifying
the stored program at runtime, are outside this structural guarantee.

**Format Document** conservatively normalizes existing spaces/tabs outside string
and REM content, removes declaration indentation and uses one space after the
line number. It preserves case, numeric spelling, line-number spelling, physical
order and line endings. Every result must compile to identical BASIC bytes;
invalid input receives no formatting edits. Repeated formatting makes no edits.

Quick fixes can insert a missing space between an existing valid BASIC line number
and its command, such as `10PRINT 1` → `10 PRINT 1`. The native code-action preview
shows the exact edits. Multiple missing separators can be repaired together;
action proposals must pass the shared complete-program check. No line numbers or
jump destinations are guessed, and querying a quick fix never changes source.
