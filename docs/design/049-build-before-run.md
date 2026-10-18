# M6 build-before-run and artifact lifetime

Decision: run compiles current source through the same core `checkProgram`
(parser, semantic analysis and encoder) and TAP writer that normal `buildTap`
uses. It adds no parser or editor-specific acceptance rules. Use the lowest
stored BASIC line from the encoded mapping as explicit TAP autostart, allowing
one action to execute after loading. Normal Build TAP keeps disabled autostart.
A valid empty source has no run entry and produces an actionable run failure.
Header name remains ZXCODE. Program bytes must match normal build exactly.

A run owns a unique temporary directory containing fixed filename `program.tap`.
Write the complete validated TAP before launching. Never overwrite the user's
normal build output. Artifact bytes are deterministic for a given source; private
paths differ per session so concurrent/earlier runs cannot observe overwritten
files. Retain the directory until the emulator session finishes, then clean it;
clean immediately on build/write/launch failure. Caller-supplied output-directory
settings do not redirect private run artifacts.

Use a host-side coordinator with a stop-capable backend. Failed compilation never
launches or replaces the current session. A successful new build is staged first,
then the previous session is stopped before launch. Serialize replacement, cancel
superseded startup and skip obsolete queued requests. If stopping an owned process
fails, retain that session/its artifact and report an actionable failure; do not
launch another process blindly. External cancellation affects startup only.
Explicit Stop/dispose cancels pending startup and waits for owned-session cleanup.

Return build diagnostics unchanged, structured host/launch failures and a managed
session on success. Expose current session without depending on VS Code. Preserve
source id/version and a deterministic opaque build hash in the run result; full
source map and stale-identity persistence remains M6-06. Hash source id, exact text,
version, target, autostart and TAP bytes so different source snapshots cannot share
an accidental identity merely because their program bytes match.

Tests use a backend that inspects the staged TAP, verifies matching program bytes
and autostart, and holds completion until explicitly released. This tests failure
ordering and file lifetime independently of Fuse. Real process failures remain
covered by the backend ticket and will be surfaced by editor Run in M6-05.

Validation: Node 24 full check passes 270 tests. Orchestration fixtures verify
normal-build program-byte equality, lowest stored autostart, artifact retention
and cleanup, failure ordering, deterministic identity, replacement, superseded
startup and failed-stop retention. The real Fuse coordinator builds/launches the
bundled sample, remains running, stops with code 0 and removes its private TAP.
Hosted CI cannot currently start jobs; cross-platform merge validation remains
pending rather than being reported as passed.
