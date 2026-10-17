# M5 editor build/check commands

Contribute `zxcode.check` and `zxcode.build` to the command palette and BASIC
editor context menu. Operate on an explicitly supplied URI or the active BASIC
document, including its unsaved current text. Reuse shared checkProgram/buildTap
and the live Problems adapter; never spawn a CLI or maintain an editor parser.

Build accepts an optional output URI for programmatic callers. Otherwise a saved
source gets a sibling `.tap`; an untitled source asks for a save destination.
Use workspace.fs for output, supporting workspace/remote URIs. Reject output equal
to source and local filesystem inode aliases before writing. Syntax failures write
no TAP. Unexpected I/O errors become useful Output messages and error results.
Default header name is ZXCODE, padded to ten bytes; autostart is disabled (0x8000).
Configurable defaults belong to the following settings ticket.

An owned ZXCode Output channel records source, diagnostic code/severity/location,
check outcome and full generated TAP URI. Show it for commands without stealing
editor focus. Return a structured success/error result for automation and tests.
No implicit source save is required. Native Problems remains the same shared
compatibility authority used during edits.

Real-host tests invoke active and explicit sources, inspect output TAP framing,
verify dirty text is compiled, reject source aliases and preserve output on failure.

Node 24 full checks pass 250 tests. The real host passes active/explicit checks,
TAP framing/header inspection, disabled autostart, same-file and hard-link source
protection, failure preservation of an existing TAP, dirty-buffer builds and
non-BASIC rejection. Existing Problems, completion and navigation checks pass.
