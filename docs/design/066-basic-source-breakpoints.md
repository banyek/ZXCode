# M8 BASIC source breakpoints and execution indication

Decision: implement a BASIC coordinator above the portable machine adapter and a
native inline VS Code debug adapter above that coordinator. The language core
stays editor-independent. Source breakpoints refer to existing physical source
rows/optional columns, then resolve through shared encoded statement mappings.
No BASIC labels, executable Z80 addresses per source statement or second parser
are introduced. Blank/non-executable locations are unverified, never shifted to
a different line. Other files remain independent programs.

Debug launch compiles the captured dirty document through the shared pipeline,
creates private TAP/build metadata and selects first stored-line autostart. The
owned machine must support the explicit loopback option and native TAP smartload.
The original 13.0 experiment verified cold-boot paused smartload, two unrelated
loader/parser dispatches and then the expected 17 original-ROM program dispatches.
Advertise TAP loading only after this native path is verified. No source is
instrumented or rewritten for debugging.

Use machine PC breakpoints at original dispatch 0x1B3D and report loop 0x12AC.
At a dispatch, inspect coherent registers, sysvars and the complete program image;
require pinned ROM identity, runtime FLAGS, IY, live PROG..VARS extent, byte image,
PPC/SUBPPC and exact encoded-start mapping as proven in 064. The first matching
program dispatch attests the loaded build. A false loader/syntax/direct-mode hit
may auto-continue, but it is not displayed as a source stop. After attestation,
changed image/bounds or unsupported state pauses without a source location. Known
FN slot mutation and self-modification remain unsupported; no normalization of
runtime bytes is invented. Stop-at-entry and selected line/statement breakpoints
publish only checked source ranges, with session/epoch/stop identity attached.

An explicit Pause never auto-continues. If paused between dispatches, raw machine
state remains available without pretending to know a current source statement.
The ROM report point is not a dispatch: after an attested program ends, report its
completion and terminate cleanly rather than present its continuation counter as
an executing statement. Limit pre-attestation waiting/false hits and return an
actionable unmapped stop if the expected image cannot be identified.

Source identity is the exact captured immutable SourceDocument plus version.
Any edit, close/reopen or language change invalidates the debug association,
clears its current source location and closes the owned debug session. Restart
rebuilds with a new machine/build identity. Known machine reset/load/write
invalidations similarly cannot silently reuse the prior binding. Normal Fuse Run
has a separate owner and is unaffected.

The native UI initially accepts saved local files (including dirty editor text);
untitled/non-file source-path presentation is not claimed without a separate
client source-reference proof. The inline adapter provides launch/configurationDone, source breakpoint locations,
setBreakpoints, one thread/current mapped stack frame, continue/pause/disconnect
and native stopped/continued/terminated events. Source scopes/variables and BASIC
stepping remain separate tickets; unsupported step commands are not approximated
by a Z80 instruction. No fake call stack or unproven source range is shown.
Initial settings select the optional debug executable explicitly and require a
trusted workspace. Machine strings and subprocess operations remain in runner.

Validation must cover pure mapping/refusal cases, native breakpoint UI/protocol,
stale-source teardown, actual cold-boot TAP loading, false-hit auto-continue and
representative statement/control-flow breakpoints in the real original-ROM
machine. The independent normal Run/native editor workflow remains a regression
gate. No emulator/ROM is packaged or required by normal unit tests.

## Actual validation

The real original-ROM coordinator run passed eight selected source stops:
10:1, 20:1, 20:2, 100:2, 20:3, 20:1, 30:2 and 50:1. It did not show loader hits
or hit the unreachable 200:2 IF tail, and it cleaned its private tape on the ROM
report. A second run proved source invalidation clears location synchronously,
refuses Continue and removes private artifacts. Native installed-VSIX verification
passed entry and IF-tail GO SUB breakpoints, checked stack-frame UTF-16 ranges,
and source-edit termination. The reports are retained in
[coordinator evidence](../evidence/m8-source-breakpoints.json) and
[native evidence](../evidence/m8-native-basic-debug.json).

The full Node 24 suite covers strict production mapping, relocated offsets,
source-instance identity, breakpoint planning without blank-row shifting, invalid
build startup and the resume/pause race. A two-observer regression also checks
that the second machine breakpoint does not re-enable an already-enabled global
table. Optional real checks use:

```sh
node scripts/research/verify-basic-breakpoints.mjs --executable <loopback-capable-13.0> --output-dir <new-directory>
ZXCODE_TEST_ZESARUX=<loopback-capable-13.0> npm run test:vsix
```

No emulator/ROM enters normal tests or packaging. Hosted validation remains a
merge gate, independently of these local original-ROM/native proofs.
