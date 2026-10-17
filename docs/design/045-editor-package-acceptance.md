# M5 installable editor package and acceptance

Build an installable VSIX with Microsoft's pinned vsce, using an explicit staged
allowlist: runtime bundle, manifest, grammar, language configuration, README,
getting-started guide and sample. Runtime core is bundled; remove workspace-only
package dependencies from the staged manifest. Exclude test runners, sourcemaps,
source trees, node_modules and local settings. Preserve repository identity and
package version. Do not publish to Marketplace or choose a repository license.
The repository currently has no license; packaging explicitly permits its absence
rather than inventing licensing terms.

Normalize archive entry ordering, timestamps and attributes with pinned JS ZIP
code after vsce produces its standard container. Two builds from identical inputs
must have identical SHA-256 and payload, independent of filesystem mtimes. Emit a
content/size/hash manifest beside the VSIX so the payload is reviewable.

Install the actual VSIX into an isolated extension directory, then run the same
open/edit/Problems/completion/navigation/build/settings smoke against its installed
extension id. Use a separate empty test harness as the development extension, so
the source checkout cannot shadow the installed ZXCode package. Assert the loaded
extension lives in the isolated installation. User extensions/settings stay intact.
CI retains VSIX/manifest and runs this acceptance as well as development-host tests.

Packaging uses the official documented vsce workflow:
https://code.visualstudio.com/api/working-with-extensions/publishing-extension
https://github.com/microsoft/vscode-vsce

Local acceptance: Node 24 full check passes 250 tests. Two isolated vsce builds
produce byte-identical archives after normalization. The installed package passes
all editor workflows in both the local installation and a freshly downloaded VS
Code 1.140.0; the bundled sample is opened and compiled from the installed package.
CI additionally compares payload/hash manifests from Linux, macOS and Windows.
