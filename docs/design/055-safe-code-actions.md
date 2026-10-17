# M7 diagnostic code actions

Decision: code actions are synchronous shared language-service queries over an
immutable document snapshot. Each action has a stable action ID, quick-fix kind,
title, the actual shared diagnostics it addresses, checked UTF-16 source edits
and the complete proposed text for preview. Query results carry the exact snapshot
identity. Hosts discard stale results and submit one version-bound edit; source
is never changed by querying. No host guesses fixes from localized message text.

The first supported diagnostic family is ZX1002 (invalid line-number field),
specifically an ASCII decimal prefix immediately followed by an ASCII letter,
with a numeric value in 1..9999. Insert one ASCII space between those existing
fields. This repairs `10PRINT 1` to `10 PRINT 1`, or `20REM text` to
`20 REM text`. Preserve all existing digits, case, indentation, body text, REM
contents and line endings. Do not infer a number, remove digits, renumber a line,
change an out-of-range declaration or invent a missing command.

Match only current shared ZX1002 diagnostics at the invalid physical header,
then validate the proposed complete program through the shared check/encode
pipeline. If any syntax/compatibility error remains, offer no action for that
proposal. Warnings need not block a repair. An individual fix is offered only
when independently valid. When multiple eligible headers together repair the
whole program, offer one atomic family action containing their disjoint edits,
keyed by the same diagnostic code. Do not offer overlapping duplicate plans.
The operation makes no binary-equivalence claim for initially invalid input.

This narrow first family is intentional. Missing line targets do not prove the
intended destination; duplicate numbers do not prove which declaration to keep;
unterminated strings do not prove intended quote placement; unknown escapes do
not prove literal-brace intent. Those diagnostics get no speculative fixes.
Future fixes require their own explicit preconditions and validation contract.

VS Code exposes ordinary quick fixes with WorkspaceEdit so its native preview
is available before application. Associate the exact shared diagnostics with the
native action and do not set a preferred/default automatic fix. No automatic
save fixes or fix-all source action is registered. Native provider cancellation,
range filtering and snapshot guards apply as for other language queries.
