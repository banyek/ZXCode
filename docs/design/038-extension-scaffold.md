# M5 VS Code extension boundary and smoke path

The extension is a third workspace, `zxcode-vscode` (development identity
`banyek.zxcode-vscode`, display name ZXCode). It depends on the shared core and
contains only editor document/lifecycle/range adapters. The core continues to
compile with no host/editor ambient types, and import boundaries also forbid
extension imports from core. No parser, encoder or alternate acceptance grammar
is introduced in the extension.

The initial tested editor/API floor is VS Code 1.140.0, matching the installed
stable development host and the pinned official API types. Tooling pins esbuild
0.28.2 and @vscode/test-electron 3.1.0 from the official npm registry; development
commands remain Node 24. The extension bundles to CommonJS with `vscode` external,
following the official [bundling guide](https://code.visualstudio.com/api/working-with-extensions/bundling-extension).
The desktop workspace extension host owns the VS Code API import.

Activation is scoped to `onLanguage:zx-spectrum-basic`; real language registration
and filename association policy remain M5-02. Automated host tests explicitly
activate the development extension before that contribution exists. The scaffold
exports its document/query adapter for integration tests; it does not add temporary
UI commands or analyze unrelated plaintext documents automatically.

Document adapters cache a core session by URI and editor document instance.
Same-version reads reuse the immutable snapshot; increasing versions update it.
A reopened document instance creates a fresh session even when its URI/version
matches an earlier instance. Closing an older instance cannot evict a replacement.
Core-to-editor ranges are converted through the actual TextDocument offsets only
when URI/version/text still match; stale results are rejected rather than mapped
onto a newer document. Closing/deactivation releases session ownership.

The automated smoke path uses the official
[extension test runner API](https://code.visualstudio.com/api/working-with-extensions/testing-extension)
with a pinned editor version, isolated user/extension directories and a small
Promise-based test entry. It activates the real bundle, opens/edits a document,
checks shared diagnostics/navigation and verifies Unicode/CRLF/stale range
conversion. A supplied VS Code executable can reuse a local installation; CI uses
an isolated downloaded host under Xvfb on Linux. No user's installed extensions,
settings or normal workspace are modified. F5 development-host launch configuration
and normal type/build checks accompany this path.

The installed 1.140.0 host reports Node 24.21.0. Its isolated development-host
smoke passes activation, versioned edits, shared diagnostics/navigation, actual
CRLF mapping, two-unit emoji diagnostic spans and stale-result rejection. The
CI smoke uses the pinned downloadable editor on Linux under Xvfb.

Final Node 24 validation passes 246 tests plus the real-host smoke. Lifecycle
regressions cover same-version reuse, increasing/stale versions, reopened document
instances, old close events and disposal. The extension has a pinned automated
Linux development-host CI gate; all core/platform fidelity gates remain in place.
