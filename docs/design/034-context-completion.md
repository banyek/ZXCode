# M4 parser-context completion

Completion uses the existing recoverable parser over the snapshot prefix ending
at the checked UTF-16 cursor. This gives parser-owned incomplete nodes and real
string/REM modes even when later text would change the parse. Prefix CSTs are
query-local, cached per snapshot/offset; they never replace the coherent full
analysis used for diagnostics, symbols or builds. Source ranges remain offsets
from the original start, and edits are recreated against the full snapshot.

A syntax-layer context helper owns structural grammar decisions. It examines the
current numbered line/statement, nested IF tail, expression path and consumed
FOR/LET delimiter ranges. These ranges are recorded where the real parser consumes
them; no completion regex reinterprets a command's grammar. A partial lexical word
is the filter/replacement span; a cursor within a word replaces its full original
token. Context queries preserve case-sensitive source bytes and use ASCII folding
only to match authentic catalogue spellings.

Statement-start candidates are available target-profile commands. PRINT item
starts additionally offer AT/TAB/colour controls with expressions. Numeric/string
expectations come from CST operand roles, identities and shared built-in signatures.
FOR initial/limit/STEP and IF condition/THEN continuations follow parser state.
GO TO/GO SUB expression contexts rank existing real line numbers first without
constant folding, labels or numbering generation. Function return types filter
candidates, and local FN formals are scoped to the owning definition. Identifiers
in strings/REM are never command/value candidates; ordinary empty/unnumbered source
requires a real BASIC number and does not synthesize one.

Results are plain text edits, contextual candidate lists and explicit incomplete
flags tagged with snapshot identity. They do not encode keybindings or assume Tab,
snippets, an editor protocol or automatic source acceptance. Unknown/incomplete
contexts may provide an empty contextual list; they never fall back to every
keyword. Broader syntax/signature help metadata remains M4-07.

`parserCompletionContext` implements syntax context; `documentCompletions` caches
and filters shared catalogue/signature/symbol candidates. FOR and LET now retain
consumed delimiter ranges in their CST nodes, without changing acceptance or bytes.
Node 24's full check passes 234 tests, including all required contexts, target
availability, full-word edits, scoped FN return/argument/formal types, literal line
ranking, strict offsets and frozen versioned results. The independent 448-case
M3 gate remains unchanged and passes.
