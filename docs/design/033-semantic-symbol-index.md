# M4 semantic symbol index

The index consumes each session's existing semantic program, including valid
retained parts of invalid documents. It does not scan source words or infer names
from strings/REM/error text. Canonical variable identities come directly from the
shared analyzer: FOR/scalars share a numeric family, numeric arrays are separate,
string scalar/array uses share storage identity, and FN formals retain owner keys.
A family may have several observed kinds; the index must not split shared storage
merely to fit an editor symbol-kind enumeration.

Each occurrence records its checked name range and read/write/definition role.
LET/INPUT/READ targets and FOR variables are writes; NEXT is a read; DIM and DEF FN
plus formal parameters are definitions. Cassette DATA array names are writes for
LOAD and reads for SAVE/VERIFY. Indexed target selectors remain expression reads.
Names in typed expression/error children are reads. Local formal uses and FN calls
retain the analyzer's preferred definition range, preserving original-ROM binding
and duplicate-definition behavior for the later navigation ticket.

Stored line numbers define `line:<number>` symbols. Only the semantic jump
`lineReference` relation introduces a static line use; dynamic expressions such as
GO TO 10+10 are not folded or indexed as literal references. Missing static targets
retain unresolved use occurrences. This adds no syntax, declaration requirement or
runtime allocation/flow claims. Variable writes are source assignments, not proof
that a variable exists on every execution path.

The immutable, cached index exposes frozen records/occurrences and lookup methods
without publishing mutable Maps. Occurrences retain physical source order, while
record keys sort deterministically. Offset lookup checks UTF-16 bounds, chooses
the smallest containing name span and allows an end-of-name caret fallback. Old
snapshot indices remain independent after updates. Unsupported incomplete nodes
without semantic identities stay absent; recoverable parser context remains
available separately for completion.

`documentSymbolIndex` implements this contract over the shared semantic tree.
Node 24 full validation passes 222 tests. Dedicated cases cover scalar/array/control
families, assignment/input/read/cassette roles, scoped and duplicate FN/formal
bindings, dynamic versus literal line targets, incomplete-document retention,
opaque text, checked offset lookup, immutable records and old snapshot caches.
The index prefers `formalRange` for formal uses; their separate function-scope
`definitionRange` is not the parameter's declaration location.
