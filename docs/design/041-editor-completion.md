# M5 completion and normal suggestion acceptance

Register a provider only for `zx-spectrum-basic`. Candidates, context, replacement
spans, insertion text, ordering and help come from the shared language service.
The adapter maps kinds and checked UTF-16 ranges into native completion items;
insertion uses plain authentic BASIC text, without a second snippet grammar.
Cancellation, closed documents and stale snapshots return no result.

Use VS Code's existing suggestion widget and acceptance commands, including its
normal Tab binding. Install no custom keybinding or global suggestion settings.
Documentation uses untrusted Markdown with escaped prose and code blocks.

The isolated real host verifies command and typed-expression candidates, exact
replacement ranges, empty REM/string contexts and normal widget acceptance.
Only its temporary test profile disables word-based suggestions and startup AI
chat for deterministic keyboard focus/selection; user settings remain untouched.
The real host passed native typing, suggestion selection/acceptance, typed
expression filtering, REM/string suppression and untrusted documentation.
Node 24 full checks pass all 250 tests.
