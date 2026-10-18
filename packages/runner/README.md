# ZXCode emulator runner

Node 24 host-side integration; independent of VS Code. The BASIC core never
imports the runner. Build the repository before importing `@zxcode/runner`.

```ts
import { createFuseBackend } from "@zxcode/runner";
const backend = createFuseBackend({ executable: "/absolute/path/to/fuse" });
const result = await backend.launch({
  artifact: { path: "/absolute/program.tap", format: "tap",
    target: "spectrum-48k", buildId: "your-build-identity" }
});
if (result.kind === "error") console.error(result.message);
else {
  // Keep the TAP alive until this promise resolves. Stop is optional/idempotent.
  await result.session.stop();
  const exit = await result.session.finished;
  console.log(exit.state, exit.code, exit.signal);
}
```

Install Fuse 1.8 or later separately (1.10.0 is the reproduced reference). Omit `executable` to discover identifying executables on
PATH. Explicit paths must be absolute executable files; application directories
and shell command strings are rejected. The source TAP must pass the shared BASIC
TAP reader. The backend does not edit the TAP or add autostart. Configuration has
`configurationFormat: "xml" | "ini"` (default XML on Unix, INI on Windows).

Each process gets private configuration and fixed 48K/auto-load/silent flags;
settings are cleaned after completion. Startup AbortSignal cancellation does not
kill sessions already returned to the caller. `finished` resolves structured
terminal results and never rejects; nonzero exit includes bounded stderr.

The real Fuse 1.10.0 SDL2 backend is reproduced on macOS arm64. Windows process
ownership/configuration conversions are tested, while native Windows Fuse launch
has not been reproduced on this host. See design 047 for evidence and manual
fallback, and design 048 for adapter/lifecycle decisions. Development automation
flags are optional research tools and are not used by this backend.

Managed runs also carry immutable `metadata` and a private `metadataPath` pointing
to `build.json`. It records exact source/version, hashes and checked encoder maps;
o TAP bytes change. `coordinator.currentBuild` and `buildForSession(sessionId)`
return metadata only for the active session with an unchanged observed source.
Call `observeSource({source, version})` on edits and `invalidateSource(sourceId)` on
close. An undo/reopen does not make an old run current again. Historical
`run.metadata` remains inspectable after cleanup. Encoded offsets are relative to
the BASIC program image, not TAP framing or absolute emulated memory addresses.
A debugger must separately confirm the loaded image in its backend.
