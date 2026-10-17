# M5 editor diagnostic adapter

The extension publishes the existing `languageService.diagnostics` result into a
single owned VS Code diagnostic collection for `zx-spectrum-basic` documents.
Initial open documents, opens and text changes refresh synchronously from the
versioned core session. The adapter contains no grammar or independent validator.
Original messages, codes and all four severities map directly; checked core spans
convert through the current editor document, including related locations.

Native Problems fields receive source ZXCode and stable codes. Core categories
and runtime-capability metadata stay in the cached core result; the adapter does
not invent unsupported editor tags or alter messages to mimic CLI formatting.
Build/check will reuse this diagnostic authority in its later ticket.

Publishing requires the same URI/version/text snapshot to remain current. Closing
a document, leaving the registered language or disposing the extension removes
owned diagnostics. Published ownership tracks editor document instances, so a late
close event from an earlier instance cannot erase a reopened document's results.
Listeners/collection are disposed before session ownership; no global user/editor
settings are changed. Other language documents are ignored automatically.

Real-host tests verify edits from malformed to valid source, warning severity/code,
related and information/hint range conversion and language-mode cleanup. VS Code
emits document-close/open events on a language-mode change; closing an editor tab
alone is not a guaranteed TextDocument disposal event. Existing headless core and Unicode/CRLF/stale-snapshot smoke
checks continue unchanged. The public API types come from pinned VS Code 1.140.0;
no VS Code type crosses into the core package.

Node 24 full checks pass 250 tests. The isolated real host passes live Problems
publication, malformed-to-valid clearing, warning code/severity, language-mode
close cleanup, all four severity conversions, unchanged messages/codes and related
Unicode/CRLF ranges. Existing old-snapshot and adapter lifecycle checks stay green.
