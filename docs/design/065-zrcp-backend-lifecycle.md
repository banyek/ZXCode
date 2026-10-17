# M8 ZRCP adapter integration policy

Implement the portable machine contract after 064's successful feasibility gate.
Keep all ZRCP strings, prompt framing, command prerequisites and subprocess/socket
ownership inside `@zxcode/runner`. No BASIC model, VS Code provider or M6 Run
setting is changed by this ticket.

Owned launch supports the pinned 13.0 command dialect only and requires an
explicit absolute executable. Before launch, probe version/help without reading
user config and require an explicit native `--remoteprotocol-loopback-only`
capability. Stock 13.0 lacks it and must be rejected before enabling a listener.
The retained optional source patch adds that real command-line switch; the child
is always passed the switch. This extends 062's hardcoded local experiment into
an opt-in bind option, not a bundled emulator or automatic upstream installation.
No marker string alone replaces the actual flag in launch arguments.

Allocate an ephemeral loopback port and unpredictable prompt, launch shell-free
with no user config, no config saving, null audio/video and update/statistics
requests disabled. Bound probes, connection attempts, response sizes and command
timeouts. Do not accept a foreign process/prompt if the selected port is taken.
On startup failure/cancellation, close the socket and terminate only the owned
child. Owned close requests emulator exit then uses bounded terminate/kill fallback.
Expected disconnect/errors invalidate the stop lease and settle the session once.

Attach connects only to 127.0.0.1 at an explicitly configured port/prompt. It
creates no listener and makes no claim about an existing server's bind policy.
The caller explicitly chooses the existing machine to control. Initial attach
pauses the machine and returns an entry token. Attached mode advertises a weaker
read/step/pause/resume capability set, reserving breakpoint/global state changes,
reset, writes and image loads for owned sessions. It never terminates the attached
emulator. Close leaves it in its current logical paused/running state.

For responsive, identifiable machine stops, resume uses bounded ZRCP-controlled
`run` chunks while the adapter owns the machine. Logical running invalidates the
old token immediately. Between chunks, check pause/close requests; on a machine
breakpoint, return a new stop token and event. A bounded run that exhausts its
instruction budget is not exposed as a user stop. The serialized transport has
one outstanding command and recognizes complete configured prompts across TCP
fragments. A command timeout/cancellation with uncertain outcome disconnects;
never publish a coherent stop from an unknown command state.

Owned PC breakpoints use private slots in a new no-config emulator and support
address equality initially; arbitrary expression text and unproven portable
conditions are rejected. Inspection batches hold a current paused lease, parse
only negotiated register fields and read exact mapped-memory lengths without
wrapping/truncation. RAM/register writes are checked by readback; ROM writes are not offered.
Mutations, reset and Z80 image load invalidate image epoch
and return a new stop; TAP autoload is not advertised until separately proven.
A later BASIC coordinator owns loading/ROM/build attestation and source filtering.

Native restart/reconnect means a new session identity and fresh attestation;
never reuse old tokens or pretend the source map survived a reset/load. Unit tests
must cover fragmented framing, stale token guards, timeouts/disconnect, weaker
attach capabilities and owned cleanup. An actual patched-build adapter probe is
required in addition to the fake transport before calling this integration done.
Windows owned launch is initially unsupported; loopback attach remains transport
portable. No additional emulator platform is claimed from compile-only checks.

## Exclusive control assumption

A coherent lease assumes no second debugger/client changes the machine while the
session owns it. ZRCP does not provide a server-side ownership lock. Owned launch
uses a private unpredictable prompt/port and no user config; attach is explicit
and must not be used concurrently with another machine controller. Epoch and
source attestation guard known lifecycle changes, not hostile external mutation.

## Verified integration evidence

The local Node 24 full check passed 309 tests, including fragmented TCP prompts,
wrong versions, malformed memory, command deadlines, cancellation, forged/missing
stop tokens, idle disconnect and fresh reconnect identities. The installed-VSIX
suite and reproducible package checks passed, including the unchanged Fuse Run
and complete M7 workflow. Real adapter proof passed owned loopback launch,
original-ROM hash/read, RAM/register readback, asynchronous PC breakpoint/step,
Z80 image load/dispatch state, reset, clean close, new owned identity and actual
weaker attach/detach preserving the external process and paused state. An
executable without the explicit loopback option was rejected before launch.

The [actual report](../evidence/m8-portable-adapter.json) contains no ROM or
machine-specific path. Setup and ownership limits are in the
[guide](../guides/debug-machine-setup.md). Hosted checks are still required before
merging this integration; local optional research does not bypass that gate.
