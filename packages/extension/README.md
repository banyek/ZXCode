# ZXCode extension development

This workspace adapts VS Code documents to the shared ZX Spectrum BASIC core.
Language registration and editor providers follow in the next M5 tickets.

From the repository root, use Node 24, run `npm ci` and `npm run check`, then use
F5 with **ZXCode Extension Development Host**. The scaffold activates explicitly
in the automated smoke; its language activation is `zx-spectrum-basic`.

`npm run test:extension` builds and runs the pinned VS Code 1.140.0 development
host with isolated settings/extensions. On Linux use `xvfb-run -a npm run
test:extension`. To reuse a local installation, set `ZXCODE_VSCODE_EXECUTABLE` to
its executable. The smoke verifies activation, document versions, shared queries,
Unicode/CRLF range conversion and stale-result rejection.
