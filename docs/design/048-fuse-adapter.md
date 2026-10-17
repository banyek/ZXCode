# M6 Fuse adapter and host process implementation

Decision: implement Fuse in the independent runner package. Explicit executable
paths must be absolute files with execute access; otherwise discover named Fuse
executables only on PATH and verify their bounded `--version` output identifies
Fuse. Do not install or invoke shell/file-association launchers. Resolve paths
before use. Return actionable structured errors for missing/wrong executables,
unsupported host, bad artifact, startup cancellation and process failures.

Every launch owns a temporary configuration directory. Unix uses child-only
XDG_CONFIG_HOME with fuse-emulator/fuserc; Windows uses child-only USERPROFILE
with fuse.cfg, leaving APPDATA/ROM discovery intact. Never change parent process
environment or user settings. Configuration format defaults to XML on Unix and
INI on Windows; explicit format handles differently compiled distributions.
XML is minimal `<settings/>`, INI is empty. Private config prevents reading old
preferences. Cleanup occurs on failed startup or after session completion.

Only darwin/linux/win32 hosts are supported initially. Required TAP paths are
absolute existing readable regular files, checked with the shared core TAP reader; target/format/build id are validated
at runtime. Version probing has a short deadline and uses the same private
configuration. Discovery accepts only an identifying Fuse version response.
Windows native execution remains unverified here; cross-platform process tests
and platform configuration/argument tests do not substitute for that evidence.

Normal arguments select 48K, auto-load, disabled autosave/confirmation/sound and
the absolute TAP path as a single argument. No arbitrary user argument string is
accepted. This backend never changes the TAP or chooses its autostart line.

A reusable host process driver owns startup, bounded stderr, completion and stop.
After a successful spawn it returns a session; nonzero exit/runtime error yields a
failed completion with actionable details. Explicit stop requests SIGTERM, then
bounded SIGKILL fallback; stop is idempotent and terminal sessions are preserved.
Startup cancellation removes its listener once the session is delivered, matching
the contract. Output/error data is plain text, never interpreted as commands.
Real child-process fixtures test lifecycle and cancellation without an emulator
installation. Fuse-specific discovery/configuration gets separate adapter tests;
optional real Fuse launch research remains available outside normal CI.

The runner may consume the core TAP reader; dependency direction stays runner to
core. Core never imports runner. This reuses container validation rather than
copying a second TAP implementation into emulator integration.

Validation: Node 24 full check passes 263 tests. Real child fixtures cover zero and
nonzero completion, bounded stderr, idempotent stop, forced-stop fallback, startup
cancellation and post-delivery cancellation. Fuse adapter fixtures cover PATH
identity checking, explicit path errors, framing validation, isolated Unix/Win32
configuration, private-directory cleanup, probe timeout and probe cancellation.
The implemented backend also launches the real temporary Fuse 1.10.0 SDL2 binary,
stays running, stops gracefully with code 0 and preserves the source TAP. The
checked-in adapter evidence records its build hash and terminal result. Native
Windows emulator execution is still not claimed by these tests.
