# M4 editor-independent language-service contract

The service operates on immutable full-document analysis snapshots, including
incomplete/error source. A session accepts a SourceDocument and nonnegative safe
integer version, then requires strictly increasing versions for replacements with
the same document id. Target capabilities belong to the session options, copied
at creation. A whole-document parse/analyze pass per update is the initial model;
complex incremental parsing is deliberately deferred.

A snapshot exposes SourceDocument, recoverable CST, semantic analysis (whether
buildable or invalid), and a frozen identity containing document id/version/source.
Old snapshots remain queryable after updates; each query result carries that same
identity so clients can discard stale responses by identity comparison. Queries
must use ranges from that snapshot. UTF-16 offsets and checked SourceRange objects
are the core coordinate system; adapters convert editor positions at their edge.
Offsets are checked including EOF, never silently clamped.

The public query contract covers categorized diagnostics, completion lists with
explicit parser context/replacement ranges, structured plain-text documentation
for hover, definitions/references, symbols, and signature help. Results use core
ranges and semantic identities; they contain no editor types, URI parser, I/O,
rendered diagnostic strings, Markdown protocol payload or asynchronous transport.
An empty query result is explicit data when implemented, never a stand-in for
an unimplemented feature. M4-01 defines types only; M4-02 supplies snapshots and
later tickets implement the corresponding query functions before a complete
service object is exposed.

Symbols cover real numbered lines, numeric/string variables, arrays, DEF FN and
formals with owner scope. Numeric line references remain literal relations from
the shared semantic model; no new constant folding or labels are introduced.
Completion context and type expectations are tooling facts over parser state,
not alternate source acceptance rules. Documentation/signature metadata describes
authentic tokens and commands; grammar stays in the parser.

Contract checks compile headlessly alongside the core with no editor/host ambient
types. Runtime session and incomplete-source/query fixtures follow in M4-02..10.

The public contract is `service/contract.ts`, re-exported from the core. Compile-time
fixtures construct a recoverable incomplete-document snapshot and exercise every
query result, including signatures and edits. They reject raw source strings,
editor-style position objects and unchecked protocol ranges. Node 24's full check
passes all 209 runtime tests plus these compile-time contracts; the core compiles
without host/editor ambient types. This ticket adds no runtime query placeholders.
