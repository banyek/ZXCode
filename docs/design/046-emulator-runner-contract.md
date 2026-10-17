# M6 emulator runner contract

Decision: put host-side emulator integration in `@zxcode/runner`, outside the
language core and VS Code extension. Its initial exported contract uses no editor
protocol or emulator command-line flags. The core never imports this package.
The extension and CLI may later orchestrate it using the same compiler artifacts.

A launch request identifies an existing absolute TAP path, explicit Spectrum 48K
target and opaque build id. It does not contain BASIC source, arbitrary shell
commands or an unvalidated emulator argument string. The orchestration layer owns
the TAP file and retains it until the session's completion promise settles; the
backend must not rewrite/delete it. Backend configuration/discovery is separate
from each launch request. Optional working directory is host-side and absolute.

Backends report stable id, external-process or debug-session transport, supported
artifact/target kinds and optional lifecycle/debug features. Capability reporting
is descriptive, not a change to BASIC syntax. An external launcher can implement
launch/stop without pretending to offer pause, memory or breakpoints. A future
debug backend implements the same launch/session contract and advertises its
additional features; debugger-specific operations will have a separate interface.

Launch resolves to a structured failure or an owned session only after successful
process/session startup. Each session retains its request artifact, backend id and
stable session id. State transitions are `running -> exited|stopped|failed`; a
backend must never return a terminal session to running. `finished` resolves once
and never rejects, including runtime process errors. A successful process exit
need not imply the BASIC program finished: some emulators delegate to another
window/process, which adapter research must account for explicitly.

Stop is idempotent. It returns a structured unsupported-operation failure if the
backend cannot stop its session; otherwise it completes after the session reaches
a terminal state. Launch cancellation before startup returns cancelled without
leaking a process. Cancellation after a session has been returned is handled by
explicit stop; an AbortSignal never secretly kills an already delivered session.
No automatic rerun/kill policy is embedded in this low-level contract.

Failure codes distinguish missing/non-executable emulator, unsupported platform or
artifact, invalid request, launch/runtime failure, cancellation and unsupported
operation. Human messages must be actionable; raw exceptions/child-process objects
never cross the result boundary. Exit code and signal remain explicit nullable
fields. Source map/version/hash persistence is the later M6-06 ticket; the build id
is already present so that work can bind metadata without changing the TAP.

Type fixtures show external-process and future debug backends implementing this
contract and reject source text or editor positions masquerading as artifacts.
No emulator is launched or selected by this ticket. Selection/reproduced command
behavior belongs to M6-02, before a concrete adapter is implemented.

Validation: Node 24 full check passes 250 runtime tests plus the new compile-time
external/debug backend, cancellation, terminal-state and invalid-artifact fixtures.
Lint prevents core imports of runner and runner imports of VS Code/extension code.
