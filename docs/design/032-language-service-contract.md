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

## M4-02 session implementation decision

A factory returns a session with a private current-snapshot reference. Reading
`current` returns the identical cached object; a validated update computes one
fresh parse and semantic result before atomically publishing the replacement.
Creation/update validate actual SourceDocument inputs and safe nonnegative version
numbers. Updates reject changed document ids and nonincreasing versions without
altering current state. Independent sessions may use the same id/version; source
object identity still disambiguates them in query results.

The target profile is copied and frozen once at session creation, including its
capability array, and shared by that session's snapshots. Caller mutation cannot
change earlier or later analysis. Unknown runtime capabilities are rejected at
this host-independent boundary. Old snapshot syntax/semantic objects and source
remain available after valid or invalid updates. No query, parser or encoder stub
is introduced; the session invokes the existing recoverable parser and analyzer.

`createDocumentSession` implements the session interface. Node 24 validation passes
213 tests, including repeated cached access, incomplete/invalid analysis, retained
old snapshots, strict versions/document ids, atomic rejection, independent session
identities and capability ownership. Buildable snapshots retain the real semantic
validation brand and encode identically to direct parser/analyzer use.
