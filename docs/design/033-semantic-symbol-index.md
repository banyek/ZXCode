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

## M4-05 hover and navigation policy

Queries return checked ranges and structured plain-text documentation tagged with
the queried snapshot identity. Formal and FN uses navigate to their analyzer-bound
preferred declaration. A declaration navigates to itself; other symbols use explicit
source declarations (line/DIM/DEF FN/formal), falling back to all source writes for
variables without a declaration. Writes are assignment sites, not runtime-flow
or allocation guarantees. Missing symbols return empty definitions, while known
unresolved occurrences still support type hover and references.

References use the canonical family/scope key. By default they exclude explicit
definition-role occurrences; includeDeclaration adds those sites. Variable writes
remain references because assignment does not introduce a declaration in Spectrum
BASIC. Locations retain physical order and duplicate ranges are removed. Dynamic
jump expressions have no static line occurrence, so navigation cannot invent one.
Hover describes numeric/string variable, array, function/formal or line identity;
token documentation/signatures remain the separately scoped M4-07 ticket.

`documentHover`, `documentDefinitions` and `documentReferences` implement these
queries and satisfy the public query interface headlessly. Node 24's full check
passes 228 tests. Dedicated tests cover numeric/string variables, arrays, FN
results/formals, duplicate binding rules, literal versus dynamic line targets,
unresolved names, incomplete documents, opaque text, strict offsets and old
snapshot identities. Query locations and structured documentation are frozen.
