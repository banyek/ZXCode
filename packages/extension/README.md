# ZXCode extension development

This workspace adapts VS Code documents to the shared ZX Spectrum BASIC core.
The registered **ZX Spectrum BASIC** language selects `.zxbas` files automatically.
For generic `.bas` files, choose the language mode or opt in per workspace:

```json
{"files.associations": {"*.bas": "zx-spectrum-basic"}}
```

Generic `.bas` is not claimed globally. Highlighting is visual; shared core
diagnostics remain authoritative. Problems update on open/edit and clear when a
document closes or leaves this language. Completion uses shared context, typed candidates and authentic BASIC text. Use
Ctrl+Space to request suggestions and normal VS Code Tab acceptance. No custom
keybindings or global suggestion settings are installed. Hover, Go to Definition (Cmd/Ctrl-click), Find All References and the document
outline use the same shared model for line numbers, variables and FN symbols.

From the repository root, use Node 24, run `npm ci` and `npm run check`, then use
F5 with **ZXCode Extension Development Host**. Opening a document in the registered language activates the extension.

`npm run test:extension` builds and runs the pinned VS Code 1.140.0 development
host with isolated settings/extensions. On Linux use `xvfb-run -a npm run
test:extension`. To reuse a local installation, set `ZXCODE_VSCODE_EXECUTABLE` to
its executable. The smoke verifies activation, document versions, shared queries,
Unicode/CRLF range conversion and stale-result rejection.
