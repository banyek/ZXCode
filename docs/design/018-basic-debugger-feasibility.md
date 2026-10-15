# BASIC Debugger Feasibility and Emulator Strategy v0.1

Status: research direction, not yet a product promise.

## Key distinction

ZXCode can run a TAP in almost any suitable emulator.

ZXCode can only **control/debug** execution if one of these is true:

1. the external emulator exposes a machine/debug protocol;
2. an existing debugger bridge exposes such a protocol;
3. ZXCode embeds or links an emulator core it can control directly.

Therefore M6 external-run support and M8 debugger support need not use exactly the same emulator backend.

## Promising external path: ZEsarUX

ZEsarUX exposes the ZEsarUX Remote Command Protocol (ZRCP), a TCP remote protocol explicitly usable by external IDE/frontends. Existing VS Code Z80 debuggers such as DeZog already use it.

This strongly suggests that ZXCode does **not** need to write a Spectrum emulator merely to obtain:

- pause/resume;
- Z80-level stepping;
- memory/register access;
- machine breakpoints;
- remote machine control.

The remaining ZXCode-specific challenge is BASIC-level semantics.

## Why BASIC debugging is different

A tokenized BASIC program is data interpreted by the ROM. A BASIC source statement does not generally have its own stable executable Z80 address.

So this naive model is wrong:

```text
BASIC line 100 -> Z80 PC 0x8123
```

Instead, execution repeatedly enters shared ROM interpreter routines while interpreter state points at different locations in the BASIC program.

The likely model is closer to:

```text
BASIC source line/statement
        |
encoded BASIC program offset
        |
runtime BASIC program address
        |
ROM interpreter state / current BASIC pointer
        |
conditional machine breakpoint or debug observation
```

## Candidate breakpoint strategy

Research whether original 48K ROM maintains sufficiently stable interpreter pointers/state at a known statement-dispatch point.

If yes, a BASIC breakpoint may be implemented as:

1. identify a ROM interpreter routine reached at statement boundaries;
2. set a machine breakpoint there;
3. when hit, inspect interpreter state/current BASIC program pointer;
4. compare it to ZXCode's source-to-encoded mapping;
5. stop for the user only when the desired BASIC source location matches;
6. otherwise continue automatically.

This must be proven experimentally against the original ROM. It is not yet a contract.

## Alternative strategies

### Instrumented BASIC

Temporarily rewrite/instrument the BASIC program to call a hook.

Pros: potentially simple statement semantics.
Cons: changes the program, timing and memory layout; poor default for an authenticity-focused debugger.

Treat as fallback/research tool, not preferred architecture.

### Embedded emulator core

ZXCode controls every instruction/memory access and can observe ROM interpreter state directly.

Pros: maximum control, deterministic integration.
Cons: substantially larger integration/product burden.

### External protocol + ZXCode semantic bridge

Use ZRCP (or comparable protocol) for machine control and implement only the BASIC-aware mapping in ZXCode.

Pros: smallest emulator burden; architecture matches existing IDE debugger practice.
Cons: protocol/backend limitations may leak into advanced features.

This is the preferred first research path.

## Source mapping requirement

Encoder output should preserve at least:

```text
source line
source statement range
encoded BASIC line offset
encoded statement/token offset where meaningful
```

At runtime, after BASIC is loaded, ZXCode needs the program base/current interpreter pointer relationship to translate those offsets to live memory.

## Stepping

“Step” needs a BASIC-specific definition.

Potential user semantics:
- next BASIC statement;
- next BASIC line;
- step into GO SUB;
- step over GO SUB;
- stop after control returns from ROM/input operations.

These are not equivalent to Z80 single-step. M8 must define them only after breakpoint/state tracking is proven.

## M8 feasibility gates

### Gate A — remote machine control
Prove programmatic pause/resume, breakpoint and memory inspection against selected backend.

### Gate B — runtime BASIC location
Prove that ZXCode can reliably determine which BASIC line/statement the ROM interpreter is executing.

### Gate C — source correlation
Map that runtime state back to the exact source range using encoder metadata.

### Gate D — repeatability
Prove the mechanism on loops, IF/THEN, colon-separated statements, GO TO, GO SUB/RETURN and representative ROM calls.

Only after A–D pass should source breakpoints become a committed M8 feature.

## Current recommendation

Research **ZEsarUX + ZRCP first**. It already demonstrates the missing machine-control layer and has existing VS Code debugger integrations, so ZXCode can focus its novelty on authentic BASIC source semantics rather than recreating a Z80 debugger transport.

Keep the emulator adapter generic so another backend or embedded core can replace/supplement it later.
