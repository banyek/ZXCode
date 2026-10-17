# BASIC dispatch stepping and cold reset

## Supported step

Step Into means **resume to the next verified BASIC statement dispatch**, not one Z80 instruction and not the next physical source row. It is valid only while paused at an attested source location. The next dispatch may be another colon statement, an IF tail, the first statement of a GO SUB target, a RETURN continuation, or the same source location on another loop iteration. A false IF tail is never fabricated as an executed step. A breakpoint encountered there takes precedence in the stop reason. A ROM report ends the session rather than inventing a final source location.

This uses the same original-ROM 0x1B3D observer, source/image identity checks and full program attestation as breakpoints. M8 research (061/064) independently recorded all 17 dispatches of the loop/IF/GO SUB example with the original ROM, including relocation. The acceptance probe will compare production stepping with that exact trace. Machine-level Step is not exposed as a BASIC step. Native Next and Step Out remain explicitly unsupported: neither is approximated by lexical source order or an unproven guessed call stack.

Pausing cancels the pending source step. Source changes, a changed program or an unsupported ROM cannot preserve a valid stepping location. Inspection handles are invalidated during execution as for Continue.

## Reset

ZXCode: Reset BASIC Debug Session closes the owned machine and starts a fresh cold machine from the current source snapshot, with entry stopping enabled. This rebuilds and autoloads the TAP; it is not a claim that a CPU reset preserves the old runtime variables. Native source breakpoints are rebound through the normal launch sequence. The old machine, stop tokens, variable handles, private build and screen snapshot are never reused. Configuration and workspace trust are checked again. Editing a source still terminates its original session; an explicit new launch is required.

## Acceptance

Use the real loopback-only ZEsarUX build with the original 48K ROM, not only a protocol test double. Verify all 17 stepped dispatches against the independently observed trace, breakpoint/inspection/step/continue completion, and a fresh cold launch after reset. Installed extension coverage must verify DAP step events, current frames, watch/memory inspection and native reset ownership. Desktop visual checks remain unavailable while the Mac is locked.

## Verified results

The production coordinator matched every one of the 17 independently observed dispatches, in order, against the real loopback-only ZEsarUX 13.0 build and original 48K ROM. The probe inspected stored variables and all 6912 screen bytes between steps, ended at the ROM report, cold-launched a different machine/private TAP at entry, then repeated breakpoint → variable inspection → GO SUB step → continue to completion. A deterministic build hash can be identical across cold launches; the acceptance checks fresh machine session identity and a different private artifact path instead.

Reproduce after building with Node 24:

```sh
node scripts/research/verify-basic-stepping.mjs \
  --executable /absolute/path/to/loopback-capable/zesarux \
  --output-dir /absolute/path/to/new-empty-directory
```

The checked-in [stepping report](../evidence/m8-basic-stepping.json) records the trace. Installed-VSIX tests additionally passed native DAP Step Into from GO SUB to 100:1, then RETURN and its actual 20:3 continuation; Next was explicitly rejected. The [native source report](../evidence/m8-native-basic-debug.json) retains those frames. The [native variable report](../evidence/m8-native-basic-variables.json) proves the reset command created a different debug session at 10:1 with zero runtime variables, after inspecting populated variables in the old session. Source edits still terminate stale sessions.

Local type checks, lint and 324 runtime tests passed. These results verify native APIs, not desktop appearance: the Mac remained locked. Hosted cross-platform CI remains required before merge and is externally blocked. Unsupported step-over/out, arbitrary BASIC evaluation, mutable FN parameter-slot program images, alternative ROMs and non-macOS live-emulator testing remain outside the proven subset; normal M6 Fuse Run is independent.
