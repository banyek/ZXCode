# M7 workspace navigation boundaries

Decision: a workspace is a collection of independent BASIC documents, never a
linked program. Each document retains its own source identity, version, numbered
lines, variables, functions, diagnostics, definitions and references. A GO TO in
one file never resolves to a declaration in another. Build, Run, renumber,
formatting and code actions remain single-document operations.

The core workspace-symbol query takes explicitly supplied immutable snapshots
and returns flattened per-document outline symbols with their exact document
identity. Include lines, variables, arrays and functions; omit formal parameters
from workspace-level discovery. Filter by case-insensitive name substring, not
regex or a new naming grammar. Sort by document identity then source offset using
code-point ordering. Duplicate document identities are rejected rather than
silently mixing versions. Same-named symbols in different documents stay distinct.
No filesystem, project root, include path or editor API enters the core.

VS Code discovers unopened `**/*.zxbas` files across current workspace folders,
excluding `.git`, `node_modules`, `dist`, `artifacts` and `.vscode-test` trees.
Also include already-open documents explicitly in ZX Spectrum BASIC mode,
including opted-in `.bas` files and untitled/outside-workspace buffers. Generic
unopened `.bas` files are not claimed by discovery. This does not change language
association policy. Dirty open documents take precedence over disk contents.
Unopened disk files are decoded as strict UTF-8 into temporary core sessions;
they are not opened in tabs, added to Problems or retained as editor documents.
Unreadable/non-UTF-8 files are skipped, not repaired.

Provide native workspace symbols with file-qualified containers and an explicit
Open BASIC Program picker. Discovery runs on demand, checks cancellation between
I/O operations and does not cap results silently. A workspace/file/editor change
observed while gathering results invalidates that query. File navigation opens
the selected URI; it does not inject its lines into the active program. No
manifest, cross-file execution semantics, implicit linker or modules are added.
Single-file queries and unsaved editing keep their existing behavior.
