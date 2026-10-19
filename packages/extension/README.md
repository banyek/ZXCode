# ZXCode: original Spectrum BASIC in VS Code

Download the `.vsix` from [GitHub Releases](https://github.com/banyek/ZXCode/releases/latest)
and install it with **Extensions: Install from VSIX...** in VS Code 1.140.0 or newer.
No Node.js or source build is needed. Open a
`.zxbas` file, or choose **ZX Spectrum BASIC** as the language mode. Use Ctrl+Space
and normal Tab acceptance for suggestions, hover for Sinclair help, Cmd/Ctrl-click
for definitions and **ZXCode: Check BASIC** / **ZXCode: Build TAP** from the palette.

Follow the [getting-started guide](https://github.com/banyek/ZXCode/blob/main/docs/guides/getting-started.md)
and [sample](https://github.com/banyek/ZXCode/blob/main/examples/getting-started.zxbas).
The package also includes `getting-started.md` and `examples/getting-started.zxbas`.
Save a copy of the sample in your workspace and follow the guide.

The [build, use and test handbook](https://github.com/banyek/ZXCode/blob/main/docs/guides/handbook.md)
covers source setup, CLI workflows, editor/refactoring commands, debugger setup
and the complete test matrix.

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

For source builds, the F5 development host and native tests, see the
[development guide](https://github.com/banyek/ZXCode/blob/main/docs/development.md).

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
line number. It preserves numeric spelling, line-number spelling, physical
order and line endings. Keyword case is retained except that `GOTO`/`GOSUB`
aliases normalize to canonical `GO TO`/`GO SUB`. Every result must compile to identical BASIC bytes;
invalid input receives no formatting edits. Repeated formatting makes no edits.

Quick fixes can insert a missing space between an existing valid BASIC line number
and its command, such as `10PRINT 1` → `10 PRINT 1`. The native code-action preview
shows the exact edits. Multiple missing separators can be repaired together;
action proposals must pass the shared complete-program check. No line numbers or
jump destinations are guessed, and querying a quick fix never changes source.

Workspace symbol search discovers `.zxbas` programs in workspace folders and
already-open Spectrum BASIC buffers. Results are qualified by file; dirty buffers
take precedence over disk. Unopened generic `.bas` files are excluded. Use
**ZXCode: Open BASIC Program** to pick a discovered file. Each file keeps its own
line numbers, variables, references and build/run behavior; navigation never links
programs together. Generated/dependency directories are excluded from discovery.

With the separately installed loopback-capable ZEsarUX 13.0 build configured in
`zxcode.debug.executable`, use **ZXCode: Debug Spectrum BASIC** or a `zxcode-basic`
launch configuration. Debugging compiles the current dirty document and starts
at a verified original-ROM BASIC statement. Native line/column breakpoints use
shared source maps; loader/parser hits are filtered. Continue and Pause are
available. A pause between dispatches can have no source frame; edited or reopened
source terminates the old association and requires a fresh debug launch.

Conditional/log breakpoints, Step Over and Step Out are unavailable. Step Into
resumes to the next verified BASIC statement dispatch, including loop iterations
and GO SUB/RETURN. **ZXCode: Reset BASIC Debug Session** cold-launches a fresh
machine and stops at entry with runtime variables cleared.
Exact-image correlation refuses runtime-mutated FN slots or self-modifying BASIC;
it never guesses a nearby source location. Normal Run Spectrum still uses Fuse.
See the debug-machine setup guide in the repository for the optional executable
and its explicit loopback capability prerequisite.

Paused debug scopes expose original-ROM numeric/string scalars, numeric and
character arrays, and FOR control state with paged children. Numeric displays
show the exact stored value. Runtime strings preserve raw bytes as escaped debug
text. **ZXCode: View Memory** opens a read-only paused snapshot; it remains a
historical snapshot after resume. Malformed/unsupported variable tables do not
become guessed semantic values; raw memory inspection remains available.

**ZXCode: Show Spectrum Screen** displays a refreshable paused bitmap/attribute
snapshot with an explicit static flash phase. Retained pixels are labelled
historical while running or after termination. Native Watch supports stored
numeric/string variables, FOR values and numeric arrays with positive decimal
integer indices, for example `n(2,1)`. Arithmetic, functions and string slicing
are explicitly unavailable; watches never execute BASIC.
