# M6 persisted source/build identity and checked source maps

Decision: attach immutable schema-version-1 build metadata to each managed run and
write `build.json` beside its private `program.tap` before launch. Do not modify
TAP contents. The sidecar lives for the same owned session lifetime; the immutable
metadata remains readable through a held historical run object after cleanup.
No global source catalogue or session resumption is introduced.

Record build id, exact frozen SourceDocument/id/version, source/program/TAP SHA-256,
byte lengths, explicit target/autostart and the encoder's line/statement source
map. Source coordinates are checked UTF-16 offsets; encoded offsets refer to the
BASIC program image, excluding TAP framing. Copy/freeze mapping records and use
checked core ranges. Expose hashes and lengths rather than mutable byte buffers.
The sidecar includes the source text and mapping facts for future tooling, but it
is not an encoder authorization token or a trusted imported compiler model.
It contains no volatile path, timestamp or session id, so identical builds have
identical metadata bytes. Associate it with a process through the managed run's
session/artifact build id; its private metadata path is a separate host field.

Separate process ownership (`active`) from mapping eligibility (`currentBuild`).
The coordinator tracks an opaque source revision on each observed id/version/text.
Any change increments that revision. Closing a source removes its observation;
reopening—even with identical URI/version/text—gets a fresh revision. A running
historical build remains stoppable while its mapping becomes unavailable for the
current source. Observations never turn an older build current again after an
edit/undo/close. Build replacement/terminal process state also invalidates current
session lookup. Metadata can still be inspected as historical facts.

Expose current-build lookup only for the exact active session id and matching
source revision. Observations during pending startup must invalidate the eventual
build too; checking only the active object would miss that race. Track revisions
privately rather than trusting caller-copied metadata or equal build hash alone.
A normal output build does not change the bytes of an already launched private
run; replacement means a new launched session, even if its build hash is identical.

The editor observes changes and closes only for documents associated with Run.
Track TextDocument instance ownership so a late close event cannot invalidate a
reopened owner. Snapshot observations go through EditorDocuments; all ranges and
source text remain core objects. Source changes do not kill the emulator or
publish stale Problems. Future debugger code must request current metadata before
mapping a live editor location; raw historical metadata is deliberately retained.

Tests verify sidecar/TAP hash association, immutable maps, stored line order and
UTF-16/CRLF positions, deterministic records, source edit/undo/close invalidation,
replacement and edits during startup. Native host tests cover live invalidation
and historical-session rejection. Private directory cleanup removes both files.

External process launch does not attest current emulator RAM after manual user
interaction. The metadata provides the intended image hash/source association;
a future debugger backend must verify the loaded image before applying machine
breakpoints. Current-source eligibility is not a claim of memory attestation.

Validation: Node 24 full check passes 275 tests. Installed VSIX acceptance passes
sidecar inspection, current-session lookup, live edit invalidation before another
Run, language-mode close/reopen invalidation without killing the process, and
TAP/sidecar cleanup on shutdown. Source maps retain stored BASIC order while
pointing to correct physical CRLF/UTF-16 source positions. Hosted merge checks
remain pending while the external CI account-startup restriction is unresolved.
