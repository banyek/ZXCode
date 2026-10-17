# M8 runtime/source correlation spike contract

Before product debugging, prove a deliberately narrow mapper against actual
original-ROM dispatches. The spike's manifest binds source ID, version, UTF-16
ranges, complete compiled BASIC bytes and shared encoded line/statement mappings.
It is prepared through the shared compiler, never a second BASIC parser.

A candidate observation must be at original ROM PC 0x1B3D, runtime FLAGS set,
IY=0x5C3A, valid current PROG..VARS bounds, and CH-ADD inside that program. Require
the pinned active ROM hash, the complete current program bytes and length, and
current source hash/version to match the manifest. Find exactly one positive
length statement mapping whose encoded start equals CH-ADD minus live PROG;
require its line number/flattened ordinal to agree with PPC/SUBPPC. Only then
return the checked original UTF-16 source range. Any mismatch is unmapped, not a
best-effort nearest line. This spike's exact-byte attestation intentionally refuses
runtime-mutated FN slots/self-modified BASIC; broader attestation is not invented.

Use the control-flow sample from M8-01. Observe repeated dispatches at its normal
base and after original-ROM MAKE-ROOM inserts 64 and 257 bytes before PROG.
The [documented allocator](https://skoolkit.ca/disassemblies/rom/hex/asm/1652.html)
updates system pointers and moves memory; no hand-patched pointer list is used.
Run the original interpreter to completion at every base, and require the same
17 source ranges despite changed absolute addresses. This models channel/workspace
allocation moving the stored program; it does not claim arbitrary memory layouts.

Also load the actual stopped snapshot into the tested loopback ZRCP build, install
a machine PC breakpoint at dispatch, and collect paused register/sysvar/program
observations. Advance between stops and require all 17 mapped locations. Read
coherent data only while paused; external transport details remain research-only.
No product source-breakpoint UI may bypass these proofs. Source changes, wrong
ROM, non-dispatch PCs, syntax checking, mismatched PPC/ordinal, changed image,
out-of-bounds pointers and ambiguous mappings must all refuse source correlation.

## Actual gate result and limits

The verified local experiment passed all 17 locations at PROG bases 23755, 23819
and 24012, with identical repeated original-ROM traces. ZEsarUX 13.0's actual
paused ZRCP observations passed the same source ranges at 23755 and 24012 after
loading the real normal/ROM-relocated snapshots. The external run also reached
the expected original-ROM STOP. The [retained report](../evidence/m8-source-correlation.json)
records the five mapped traces; no ROM or snapshot binary is committed.

Reproduce after `npm run build` under Node 24:

```sh
PYTHONPATH=<skoolkit-10.1> python3 scripts/research/verify-source-correlation-rom.py --output-dir <new-directory> --zesarux <explicit-loopback-bound-13.0-build>
```

Omit `--zesarux` for the three-base instruction-level portion only. The external
experiment uses the explicit one-line listener restriction documented in 062;
it is not a production adapter implementation. Normal tests also exercise every
shared mapping at all three bases and refuse wrong ROM, syntax/non-dispatch PC,
wrong IY, edited/undo-version source, altered program bytes, bounds, line/ordinal
mismatch and interior-token addresses. No nearest-source fallback is permitted.

This meets the correlation feasibility gate for the documented sample/scope.
Product integration must still preserve coherent stop/session identity, address
listener isolation, re-attest after reset/load/reconnect and fail closed on any
unsupported runtime mutation. FN parameter-slot changes, self-modification,
alternate ROMs, INPUT/PAUSE, asynchronous BREAK/reporting and arbitrary layouts
remain outside this exact-image spike. Those limits must not be silently relaxed
when building later debugging features.
