# M5 settings and target-profile UX (schema version 1)

Decision: use native VS Code resource-scoped settings, not a ZXCode project file,
DSL, implicit line-numbering mode or alternate BASIC dialect. Configuration follows
VS Code user/workspace/folder/language precedence and resolves for the source URI.
Two settings are sufficient for the current editor release:

| Setting | Default | Meaning |
| --- | --- | --- |
| `zxcode.build.outputDirectory` | `""` | Source sibling output; otherwise a relative subdirectory of the source directory. |
| `zxcode.target.profile` | `"spectrum-48k"` | Original ZX Spectrum 48K ROM BASIC; the only currently supported profile. |

Output directories contain ordinary slash-separated directory names: no absolute
paths, URI schemes, variable interpolation, empty segments, `.` or `..`. Build
creates the configured subdirectory after successful compilation. An explicit
command output URI overrides this setting. Untitled source still asks for a save
location. Invalid effective configuration fails clearly in Output before writing.
The output filename continues to derive from the source filename. TAP header name
ZXCODE and disabled autostart remain documented fixed defaults for this release.

The profile appears in Settings with its compatibility description; there is no
selector offering unsupported machines. Validate it at command invocation even
though the manifest enum normally prevents invalid values. Editor queries always
use the same core Spectrum 48K default. Do not expose arbitrary profile JSON or
capabilities until their UX and session invalidation behavior are implemented.
Interface 1 capability modelling in the core does not itself advertise a supported
emulator configuration in this release.

Emulator preparation is the explicit generated TAP URI and stable target id. M6
will consume these through its adapter and design executable/argument settings
before adding them. No executable setting is exposed without a consumer, and no
workspace-provided process is launched in M5. A later launcher must respect workspace
trust and use argument arrays, never shell interpolation.

The contributed `configuration` manifest is the executable schema for version 1;
this document identifies the schema version without adding a redundant user-set
version flag. Future additive settings retain defaults; renamed/removed settings
need explicit migration/deprecation documentation and a schema-version change.
No versioned project file is created. Native settings storage remains owned by VS
Code; ordinary checks/builds never mutate user configuration.

Real-host acceptance changes only the isolated test workspace configuration,
verifies a nested output directory and profile rejection, then restores defaults.

Validation: Node 24 full check passes 250 tests. The isolated real host builds into
`artifacts/tapes`, reads the resulting TAP, rejects `../outside` and an unsupported
profile, and restores workspace defaults. Existing command/source safety and all
editor workflows remain green.
