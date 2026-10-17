# M4 incomplete-source service fixtures

Fixtures pin editor behavior without redefining BASIC acceptance. Each case has
source with one explicit cursor marker, version identity, expected diagnostic
code/severity/category/source spans, contextual completion inclusions/exclusions,
and exact definition/reference source locations. Hover/signature facts and outline
names are pinned where meaningful. Expected values are reviewed against the shared
parser/model and the service contracts, not captured blindly from the implementation.
Binary authority remains the independent M3 corpus.

Required incomplete contexts include PRINT AT's missing column, GO TO's missing
numeric target, FOR's missing limit/STEP and IF's missing THEN/tail. Additional
cases cover partial command words, broken quotes, malformed statements, string
operand typing, forward/missing line targets, scoped FN parameters, raw REM text,
CRLF/UTF-16 positions and invalid headers. Expectations distinguish an empty query
result from failure and do not require incomplete source to become buildable.

The fixture runner serializes checked ranges as explicit UTF-16 offsets plus
selected source text. Diagnostics are not CLI-formatted; completion edits target
the original full token, and query results must carry the queried snapshot identity.
Repeated runs and queries after an update verify determinism and stale-snapshot
isolation. All features run headlessly, with no editor APIs or protocol types.

The reviewed `service-incomplete.json` contains nineteen cases. Node 24's full
check passes 243 tests, including exact serialized diagnostics/navigation/hover,
required and forbidden contextual candidates, typed signature parameters, outline
names, deterministic repetition and old-snapshot isolation for every fixture.
