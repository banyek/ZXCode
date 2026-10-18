# M6 edit/build/run acceptance

Use the actual installed VSIX in a clean temporary profile with a separately
installed reference Fuse executable. Copy the package's getting-started sample into
the isolated workspace, open it as `.zxbas` and invoke the native Run command on
the active editor. Capture the exact launched private TAP and its metadata before
replacement/cleanup. Keep a bounded inspection interval for the SDL2 window.
Ordinary CI retains its private fixture executable; it does not claim authentic
machine execution without an explicitly supplied emulator.

The optional acceptance wrapper takes explicit Fuse, headless-automation Fuse and
ROM paths. It runs installed-package host acceptance, then validates the captured
TAP against the previously reviewed source-built sample hash. Validate source,
TAP and program hashes against the persisted sidecar, real line autostart and
checked map bounds. No alternate build is substituted for the editor-produced
TAP. The same captured tape then runs in the pinned Fuse null-UI automation build
for a bounded screen capture; confirm original ROM hash and reviewed pixel CRC.
The desktop binary/foreground window remain distinct from the capture backend.

Native acceptance also exercises repeat replacement, malformed-source retention,
missing-executable errors, current-map invalidation, Stop and shutdown cleanup.
Retain a report, native host log, launched TAP, source/build metadata and original-
ROM screen/result under an explicit output directory. These are test artifacts,
not a project DSL or changes to the user's normal build output. Do not install an
emulator, ROM or extension into the user's ordinary profile automatically.

Document exact local evidence separately from hosted checks. GitHub's current
account-startup restriction prevents merge gates from running; local acceptance
must not be described as fresh cross-platform hosted validation. Native Windows
emulator execution remains outside the reproduced evidence.

Reference-check detail: Fuse 1.10.0 `tape.c:tape_can_autoload` disables auto-load
when `memory_custom_rom()` is true. Passing an explicit `--rom-48` filename marks
it custom even if its bytes are the original ROM; the resulting copyright screen
correctly failed the reviewed pixel check. Keep default ROM selection and compare
the active 16K ROM CRC from the execution result with the SHA-256-pinned reference
file instead. No expected tape bytes or screen pixels were changed to pass.

Local result: Node 24 check passes 275 tests, reproducible VSIX packaging passes,
and the installed editor/reference-emulator acceptance completes successfully.
Native Run emits the reviewed 191-byte TAP with autostart 10; its SHA-256 is
`975c282990f43389e72aa154a1360676a993a0e76c08dcf2c72213ef3d140060`.
The active original ROM checksum matches the SHA-256-pinned reference, and capture
pixel CRC remains `c3956903`: heading, COUNT 1–3, then `9 STOP statement, 60:1`.
The native workflow verifies replacement/failure/identity/cleanup paths as well.
See `docs/evidence/m6-editor-run-acceptance.json`. A live desktop screenshot was
not captured; the reviewed image comes from the exact editor-produced TAP in the
reference Fuse null UI. No new hosted-platform or native Windows claim is made.
