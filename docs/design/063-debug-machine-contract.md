# M8 debug-machine adapter contract

Decision: add a host-side machine contract in `@zxcode/runner`, separate from the
BASIC core, RunCoordinator and VS Code/DAP types. A machine adapter knows Z80
registers, mapped memory, machine PC breakpoints and lifecycle. It knows no BASIC
line numbers, statements, source ranges or build maps. A later semantic bridge
owns original-ROM recognition and attested runtime/source correlation.

## Negotiation and ownership

A configured backend opens in launch or attach mode, with optional required
features and startup cancellation. Adapter-specific executable/endpoint/config
options belong to its factory, not the portable contract. The delivered session
reports frozen negotiated features, readable/writable register lists, memory read
limits and breakpoint capacity.
Unsupported operations return structured `unsupported-operation`; callers never
infer support merely from method presence. Only advertise features actually
implemented and verified. Weaker backends remain usable for their supported
operations. The separate M6 Run contract continues to work unchanged.

A launched session owns its process; close stops it. An attached session owns only
its transport and installed breakpoints; close removes its own breakpoints and
disconnects, without terminating the user's emulator or silently changing its
paused/running state. Startup cancellation cannot leave a delivered orphan.
Close is idempotent. Finished settles once and never rejects. Transport loss is
terminal for that session; reconnect creates a new session identity and requires
fresh runtime/build attestation.

## Coherent stops and invalidation

Each stopped event returns an immutable stop token with session ID, image epoch,
monotonic stop sequence, machine reason, PC and owned breakpoint IDs. Pause while
already paused returns the same token. Resume/step/inspect/mutations require the
exact current token object. Old tokens fail after resume, another stop, reset,
image load, writes, disconnect or close. A token is a coherence lease, not a
claim that a BASIC source/build is current.

All operations serialize through one machine owner. Inspect reads requested
registers and mapped memory while holding that same paused lease, returning
copied immutable bytes. The adapter checks its lease before and after the read
batch. Addresses/counts must be finite safe integers, within 0..65535, without
wrapping or exceeding negotiated limits. Reads never silently truncate. Writes,
reset and image load increment the image epoch and return a new stopped token;
the semantic bridge must discard prior program attestation. Resume invalidates
old inspection immediately. Natural running changes memory too; later BASIC
correlation must separately establish which runtime mutations are acceptable.

Expected faults are structured results: invalid request/state, stale stop,
unsupported operation, timeout, cancellation, disconnect, protocol or runtime
failure. If a cancelled/timed-out command leaves the machine's outcome unknown,
the adapter invalidates the lease and disconnects rather than reporting a safe
paused state. Operation cancellation is distinct from startup and close.

## Portable operations

- Pause/resume and single **machine instruction** step; no BASIC step semantics.
- Inspect a register set plus bounded mapped-memory regions at one coherent stop.
- Write memory/registers, reset or load a typed TAP/Z80 image only if negotiated.
- Install/remove session-owned PC-address breakpoints. Optional portable
  conditions are conjunctions of register equality or memory-byte equality;
  advertise supported condition kinds explicitly. Never expose arbitrary ZRCP
  expression strings. Address-only support requires no condition capability.
- Subscribe to stopped/running/invalidated/terminal events. Listener disposal is
  independent of closing the machine; listener exceptions must not corrupt the
  adapter owner. Stops may be asynchronous, so a UI must use event/token identity.

Register names and numeric values are machine facts. I/R are bytes, IFF1/IFF2
are 0 or 1, IM is 0..2, and register pairs are 16-bit unsigned integers; adapters
reject out-of-domain writes rather than truncating. Snapshot/TAP image loading is
not a claim of BASIC build identity; the adapter reports an invalidating machine
operation, and the higher layer re-attests bytes and ROM. ZRCP prompt framing,
command prerequisites, global breakpoint indices, numeric formatting and scratch
file/config/process handling stay entirely inside a future ZRCP implementation.

## Test-double and gate

The contract permits an in-memory deterministic test backend. Its fixture uses
explicit scripted machine steps; it is not a Spectrum emulator or language
reference. Contract tests exercise feature negotiation, immutable coherent reads,
old-token rejection, epoch invalidation, breakpoint ownership and close. The
public type fixtures prohibit source-line breakpoints and backend command text.
Actual ZRCP machine behavior remains supported by 062's external research probe.
M8-04 must prove correlation and relocation before product debug UI proceeds.
