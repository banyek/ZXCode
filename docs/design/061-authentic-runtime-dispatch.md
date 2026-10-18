# M8 original 48K BASIC runtime observations

Status: M8-01 research evidence, not a source-breakpoint product promise.
Authority is the SHA-pinned original 48K ROM and Sinclair documentation. SkoolKit
10.1 is an instruction-level observation tool, not the language definition.

## Documented state and candidate routines

The original [manual chapter 25](https://worldofspectrum.org/ZXBasicManual/zxmanchap25.html)
documents these little-endian word/single-byte system variables:

| Address | State | Research role |
| --- | --- | --- |
| 0x5C3B | FLAGS, byte | Bit 7 distinguishes runtime from syntax checking |
| 0x5C42 | NEWPPC, word | Pending line transfer |
| 0x5C44 | NSPPC, byte | Pending statement transfer |
| 0x5C45 | PPC, word | Current interpreted line |
| 0x5C47 | SUBPPC, byte | Statement ordinal at the selected dispatch boundary |
| 0x5C4B | VARS, word | End of stored program/start of variables |
| 0x5C53 | PROG, word | Current stored-program base |
| 0x5C55 | NXTLIN, word | Next line address |
| 0x5C5D | CH-ADD, word | Interpreter character pointer |
| 0x5C6E/0x5C70 | OLDPPC/OSPCC | CONTINUE location, not a dispatch location |

The [main parser](https://skoolkid.github.io/rom/asm/1B17.html) is shared by syntax
checking and execution; a PC hit alone cannot identify a running BASIC statement.
The [statement loop](https://skoolkid.github.io/rom/asm/1B28.html) enters at 0x1B29,
then clears workspace, increments SUBPPC and skips separators/end markers before
reaching 0x1B3D. At **0x1B3D**, before command dispatch, CH-ADD identifies the
command token and SUBPPC has its current ordinal. At 0x1B29 the counter has not
advanced yet, and not every visit denotes a command. Thus 0x1B3D is the stronger
candidate observation point for this ROM image. This is a ROM-specific PC, not
an executable address assigned to a BASIC source statement.

[STMT-RET](https://skoolkid.github.io/rom/asm/1B76.html), at 0x1B76, observes the
post-command pending transfer before the interpreter chooses its next statement.
[NEXT-LINE](https://skoolkid.github.io/rom/asm/1BD1.html) prepares character/counter
state, while [LINE-NEW](https://skoolkid.github.io/rom/asm/1B9E.html) resolves a
pending line bound. [GO TO](https://skoolkid.github.io/rom/asm/1E67.html) stores a
pending statement value of zero; this is not the same as dispatch ordinal one.
[GO SUB](https://skoolkid.github.io/rom/asm/1EED.html) saves a statement continuation,
which matters when returning into a colon-separated or IF tail.

## Repeatable original-ROM experiment

`examples/debug/runtime-dispatch.zxbas` uses two FOR iterations, true/false IF
tails, GO SUB/RETURN within an IF tail, colons, NEXT, GO TO and STOP. The shared
CLI builds its tape. The research harness loads through the original ROM with
loader acceleration disabled, stops at the dispatch PC, then observes actual
instructions in two fresh copies of that loaded state. The ROM SHA-256 and
0x1B3D instruction bytes are checked before observation. No ROM is committed.

Both runs produce this independently reasoned command sequence:

```
10:1 10:2 20:1 20:2 100:1 100:2 20:3 30:1 40:1
20:1 30:1 30:2 40:1 50:1 200:1 210:1 210:2
```

The first IF executes GO SUB and resumes at 20:3 after RETURN. The second loop
iteration skips that entire false IF tail. Line 30's IF executes its LET only on
the second iteration. NEXT revisits the loop, and GO TO skips the subroutine on
normal flow. The final IF's false tail skips STOP; the actual STOP is 210:2.
Every selected dispatch has runtime FLAGS, a CH-ADD inside PROG..VARS and an
original command-token byte. The report records absolute addresses and offsets
relative to PROG, plus pending transfers and the earlier counter-stage visits.

Two pitfalls were exposed by the actual probe rather than inferred away:

- GO SUB's post-command pending NSPPC is **0**, while RETURN records **3** to
  resume at 20:3. Do not present pending transfer state as the current dispatch.
- At the report/edit-loop point 0x12AC after STOP at 210:2, PPC is 210 but SUBPPC
  and the continuation ordinal have become **3**. A debugger that samples arbitrary
  paused state would falsely identify the next statement without a stop reason.

The full [actual trace](../evidence/m8-runtime-dispatch.json) retains both stages
and post-command transfer states; the probe requires the 17-event sequence and
matching repeated observations. Reproduce under Node 24 with:

```sh
PYTHONPATH=<skoolkit-10.1> python3 scripts/research/verify-runtime-dispatch-rom.py --output-dir <new-directory>
```

## Candidate strategy and remaining gate

A future machine adapter could stop at the verified dispatch PC, read a coherent
machine state, require the original ROM identity/runtime flag/stored-program
bounds, and compare CH-ADD minus PROG with an attested build's encoded mappings.
Only a proven match would become a source stop; unrelated parser/direct-mode
hits would continue. Filtering must not mistake syntax checking, separator visits
or post-error continuation state for executable statements.

Not yet proven: an external backend's atomic pause/read/continue behavior and
breakpoint rearming; relocated program bases; RAM/program identity after loading,
FN slot mutation or self-modification; asynchronous STOP/BREAK, INPUT/PAUSE and
ROM calculator calls; 128K/alternate ROMs; step-in/over/out policies and nested
subroutine stack presentation. This probe uses one normal loaded base and no
external transport. M8-02 must demonstrate control, and M8-04 must prove actual
source-map correlation and relocation before any source-debugging UI is promised.
