# Runtime capability policy (M2-16)

ZXCode recognizes original 48K ROM vocabulary independently of attached hardware.
The default target profile is `spectrum-48k` with no extension capabilities. A
caller may declare the `interface1` capability in an explicit target profile;
this is an execution-environment assertion, not a different BASIC grammar.

## Verified ROM boundary

The original ROM command table sends CAT, FORMAT, MOVE and ERASE to 0x1793:
a relative jump to REPORT-O-2 at 0x1725, which executes `RST 0x08` followed
by error byte 0x17 (Invalid stream). Independent ROM syntax
probes still accept their documented original-ROM operand classes. These four
commands require Interface 1 or a compatible extension to execute usefully.

[OPEN # at 0x1736](https://skoolkit.ca/disassemblies/rom/hex/asm/1736.html) and
[CLOSE # at 0x16E5](https://skoolkit.ca/disassemblies/rom/hex/asm/16E5.html) have
actual base-ROM implementations. OPEN supports the built-in K/S/P channels,
including lowercase channel strings; CLOSE closes ordinary streams and restores
the initial stream 0..3 associations. They do not inherently require Interface 1.
Runtime channel strings, stream ranges and already-open custom channels remain
runtime matters, as with other expression/domain-dependent ROM commands.

## Diagnostics and encoding

All six commands retain authentic syntax/type validation and normal token encoding.
CAT/FORMAT/MOVE/ERASE on a target without `interface1` receive warning ZX4001,
category compatibility, with capability `interface1` and the source command range.
The warning says the command is authentic but requires a runtime extension; it
never describes the token as non-48K syntax. Warnings do not prevent check/build.
Declaring the capability suppresses that warning, not syntax/type diagnostics.
OPEN/CLOSE receive no blanket hardware warning. The profile propagates through
semantic analysis, check and TAP build so editor and build policy can share it.

No additional Interface 1 command syntax or cassette/microdrive forms are enabled
here. Printer output retains its existing no-static-hardware-error policy because
the base ROM discards output when a printer is absent. No host hardware probing or
channel-expression execution is added.

## Default completion policy

The shared command-availability API reports vocabulary identity, required runtime
capability, availability and whether to suggest the command by default. Commands
requiring an undeclared extension remain available in explicit vocabulary/search
results but are omitted from ordinary default suggestions. They become default
suggestions when the target declares the capability. OPEN/CLOSE and all other
original-ROM commands remain default suggestions. Later language-service clients
must consume this metadata rather than maintain a separate hardware keyword list.
