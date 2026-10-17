# M5 hover, navigation, references and outline adapters

Register native hover, definition, reference and document-symbol providers for
`zx-spectrum-basic`. All semantic decisions, preferred definitions, declarations
and outline hierarchy come from the shared language service. Convert only current
snapshot spans to native UTF-16 ranges and locations. Forward the native reference
includeDeclaration option unchanged. Cancellation and closed/stale documents
produce no result. Dispose all registrations before the shared document owner.

Hover uses the same untrusted documentation renderer as completion. Outline kinds
map line to number, variable to variable, array to array, function to function and
parameter to variable. Preserve names, details, physical source order, selection
spans and children without constructing new semantic relationships in the host.

Real-host command queries verify line navigation, variable/FN definitions and
references, keyword help and nested document symbols against core results.

Node 24 full checks pass 250 tests. The isolated VS Code host verifies native
line/FN/variable definitions and references against the core, escaped hover prose
and exact ranges, plus recursive outline names, selection spans and children.
