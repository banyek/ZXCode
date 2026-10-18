# M8 controllable machine backend evaluation

Decision: ZEsarUX/ZRCP is the leading external-machine research path after an
actual machine-control proof. It is not yet a shipped ZXCode backend. Keep Fuse
as M6's normal Run target; keep BASIC semantics above a separate machine adapter.
M8-03 defines that contract and M8-04 must still prove source correlation.

## Pinned ZEsarUX experiment

Evaluated official **ZEsarUX 13.0**, tag `ZEsarUX-13.0`, commit
`0bb4277d714128311d78bc0625fb12ae8308899a` (release 2026-06-09). The downloaded
GitHub release archive SHA-256 was
`2d558fa8baf474f83e0ed0c15f1ae727fad2ebbc47f692bc2a9081cb56cbe3b5`.
Primary references: [release source](https://github.com/chernandezba/zesarux/tree/0bb4277d714128311d78bc0625fb12ae8308899a),
[protocol implementation/help](https://github.com/chernandezba/zesarux/blob/0bb4277d714128311d78bc0625fb12ae8308899a/src/zrcp/remote.c),
[build instructions](https://github.com/chernandezba/zesarux/blob/0bb4277d714128311d78bc0625fb12ae8308899a/src/INSTALL),
and [license](https://github.com/chernandezba/zesarux/blob/0bb4277d714128311d78bc0625fb12ae8308899a/src/LICENSE).

Compiled a temporary macOS arm64 headless build with networking/pthreads enabled
and GUI/audio dependencies disabled. No global installation, user configuration
or ZXCode product process launcher was changed. The release includes the same
48K ROM SHA-256 already pinned by our independent ROM research; the probe also
reads all 16K of the active mapped ROM and verifies that hash. ROM payloads are
omitted from the committed transcript.

### Actual listener constraint

In the pinned source, `remote.c` passes NULL to `assignar_adr_internet`; the
network implementation maps NULL to INADDR_ANY. The general ZRCP command session
accepted commands without authentication. No loopback-bind option was found in
that release's option parser. For the local experiment, applied the retained
[one-line research patch](../../scripts/research/zesarux-13-loopback.patch) to bind
127.0.0.1. No CPU, ROM or protocol-command semantics were changed. The evidence
explicitly identifies this modification; it is not evidence that an unmodified
release provides loopback-only binding. A product launcher must resolve this
isolation constraint rather than silently enabling a general remote listener.

### Verified commands and outcomes

`verify-zrcp-control.py` owns a subprocess, reserves an ephemeral loopback port,
uses no user config, disables update/statistics requests and always cleans up.
It serializes newline-terminated commands and waits for the configured prompt,
with timeouts and bounded response buffers. The actual retained
[transcript](../evidence/m8-zrcp-control.json) proves:

| Operation | Command family | Observed result |
| --- | --- | --- |
| Version | `get-version` | 13.0 |
| Pause | `enter-cpu-step` | Paused prompt and stable register access |
| Registers | `get-registers`, `set-register` | PC set/read at 0x8000 |
| Memory | `read-memory`, `write-memory` | Scratch bytes and active ROM hash verified |
| Breakpoint | Enable global breakpoints, then set/enable condition | `PC=32769` stopped at 0x8001 |
| Step | `cpu-step` | NOP advanced PC from 0x8001 to 0x8002 |
| Bounded execution | `run 20` | Returned to a paused prompt |
| Resume/pause | `exit-cpu-step`, then `enter-cpu-step` | CPU register progress observed |
| Reconnect | `quit`, new TCP client | Same owned scratch program retained |
| Reset | `reset-cpu` | PC became 0 |
| Lifecycle | `exit-emulator` | Owned process exited with code 0 |

The first exploratory command order exposed a prerequisite: set/enable of an
individual breakpoint fails until global breakpoints are enabled. The retained
passing probe checks every response for errors and uses the correct order.
Breakpoints are tested against machine state, not a fabricated BASIC PC.

## Transport and platform constraints

ZRCP is a prompt-framed TCP text protocol, not JSON or DAP. Numeric encodings and
hex memory responses need explicit parsing. A paused command acknowledgement is
required before coherent multi-read state inspection. Global breakpoint state,
indices and memory zones are shared machine state; ownership needs an adapter
policy. Reconnection does not itself prove that a loaded build is still current.
A debugger must re-attest the machine/program after reset, load or reconnect.

`run` uses a ZRCP-controlled execution loop and can block its command response;
the source documents socket input/disconnect as interruption conditions. Native
free-running `exit-cpu-step` is a different operation. This probe verifies bounded
`run`, not an asynchronous source-breakpoint event protocol or interruption race
handling. Those remain adapter work. Startup output and register formatting also
need versioned protocol handling rather than assuming all future versions match.

Upstream describes Unix/macOS/Linux and Windows support. The actual control
experiment covers macOS arm64 only; Windows/Linux process launch, loopback patch,
reconnect behavior and packaging are unverified. Source is GPLv3; upstream also
notes separately licensed bundled ROMs/media. This research ships none of them.
No dependency, binary, ROM or emulator download is added to normal CI or the VSIX.

## Alternatives compared

| Candidate | Evidence here | Fit and remaining cost |
| --- | --- | --- |
| ZEsarUX/ZRCP external process | Actual pause/register/memory/breakpoint/step/reconnect/reset/exit probe | Strongest tested external control path; prompt framing, isolation and identity ownership still required |
| Fuse 1.10 external process | M6 launch/stop/original-ROM Run proof; local manual describes interactive monitor and startup debugger commands | Keep normal Run; no equivalent bidirectional remote-control transport demonstrated here |
| SkoolKit 10.1 in-process research simulator | M8-01 direct instruction/memory observation and repeated dispatch trace | Deterministic research/reference target; embedding would add host/runtime/distribution work; not a production adapter decision |
| Other embedded emulator cores | No prototype evaluated | Do not claim capabilities or choose one from documentation alone |

Fuse's local source license is GPLv2; SkoolKit package metadata is GPL-3.0-or-later.
Licensing is recorded as a selection constraint, not a decision to redistribute
or link an emulator. The tested machine capabilities satisfy M8-02's feasibility
criterion, while source breakpoints remain gated on M8-04.

## Reproduction

Extract the pinned release, apply the loopback patch at its root with `patch -p1`,
then configure/build in `src`:

```sh
./configure --disable-cocoa --disable-sdl --disable-xwindows --disable-xext --disable-curses --disable-cursesw --disable-aa --disable-caca --disable-coreaudio --disable-alsa --disable-pulse --disable-dsp --disable-sndfile --disable-fbdev
make -j4
python3 /path/to/ZXCode/scripts/research/verify-zrcp-control.py --executable /absolute/research/src/zesarux --output-dir /absolute/new-evidence-directory
```

Pass only the explicitly loopback-bound research build to this probe. It creates
a short-lived local control session and modifies only its owned emulated RAM/CPU.
The complete local log/transcript remains in the chosen evidence directory.
