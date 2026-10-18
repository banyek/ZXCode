# M6 Run Spectrum and Stop editor adapter

Decision: add native `zxcode.run` / `zxcode.stop` commands, a BASIC editor title
Run action and a Stop action while startup/session ownership exists. Run accepts
an explicit source URI or the active BASIC document. Use its current versioned
core snapshot and the independent RunCoordinator; UI code contains no emulator
flags, executable probing, TAP assembly or process management.

Extend RunCoordinator input with an optional backend captured per request. This
lets configuration changes choose a new backend for a valid replacement while a
failed build keeps the existing process/configuration. All requests still use one
serialized coordinator; creating a second owner on settings changes is forbidden.

Add native machine-overridable, restricted executable and configuration-format
settings, plus a backend enum containing Fuse. The UI passes configuration to the
runner factory; it never guesses platform paths/flags. Defaults retain PATH
discovery and the runner's platform format. Existing target/output settings remain
compatible. Run validates the Spectrum 48K profile but ignores normal build output
directory because its TAP is private. Do not launch from an untrusted workspace.
No automatic run happens on open, edit or configuration changes.

Show cancellable startup progress and useful messages in the shared ZXCode Output
channel. Keep live Problems tied to current editor text. Run diagnostics are logged
against the queried snapshot, even if the user edits while startup is pending.
Report source version/build id and artifact path on success, then log terminal
process failures/completion. Return small command DTOs, not session callbacks.
Expose the owned runner through the extension API for future session integration.

Stop cancels pending startup and awaits process/artifact cleanup. Deactivation
awaits coordinator disposal; registration disposal initiates the same idempotent
shutdown. Errors stopping an owned process remain visible and retain ownership.
Context keys reflect the current coordinator, so completion of an old run cannot
clear a newer run's UI state. Repeated Run uses the coordinator's documented latest
valid request/replacement policy.

Bundle core and runner through explicit absolute esbuild aliases. Extension and
runner imports must share one core implementation/private-brand domain; resolving
one through source paths and another through compiled workspace exports could
otherwise include duplicate cores. Tests continue through both development and
installed-package hosts, with a private fake executable for ordinary CI and an
optional configured real Fuse for M6 acceptance.

The backend now requires Fuse 1.8 or later: upstream's 1.8 changelog introduced
XDG configuration on Unix. Accepting older versions could silently read a user's
legacy settings instead of the private directory. Add an explicit unsupported-
version failure rather than treating a recognizable old binary as compatible.
The reproduced reference remains 1.10.0; the minimum derives from upstream's
configuration-path change, not from assuming native Windows execution was tested.

Native host acceptance passes active/explicit Run, autostart, valid replacement,
failed-build retention, missing executable reporting, Stop and shutdown artifact
cleanup. The installed VSIX passes the same workflow with a private fixture
executable. An additional real-host run uses the actual Fuse 1.10.0 SDL2 binary
through these editor commands. Hosted CI remains externally unavailable, so these
local results do not claim new Linux/Windows hosted validation.

The final Node 24 full check passes 272 tests. The final installed package also
passes its reproducible rebuild/payload check and native Run/Stop/shutdown smoke.
