# M8 original 48K runtime variable decoding

Decision: runtime variable decoding is a host-independent byte decoder in core,
not a source parser, evaluator or emulator client. Runner obtains a coherent
paused VARS..E_LINE slice through the portable machine API. Original
[manual memory/variable diagrams](https://worldofspectrum.org/ZXBasicManual/zxmanchap24.html)
and the ROM [NEXT-ONE traversal](https://www.skoolkit.ca/disassemblies/rom/asm/6584.html)
are the binary authority. Runtime names use existing canonical identity families;
records remain in actual memory order and carry byte offsets, not source ranges.

Support all six documented record forms: short numeric scalar (tag 011), long
numeric scalar (101, final name byte bit 7), string scalar (010, length+bytes),
numeric array (100, length/dimensions/five-byte values), character array (110,
length/dimensions/bytes), and FOR control (111, value/limit/step plus continuation
line/statement). The 0x80 terminator must end the supplied variable table. Array
dimensions include the final character width for character arrays and values are
flat in original row-major order; no invented source declarations are emitted.
FOR variables expose their numeric current value plus loop metadata. Numeric
scalar and numeric-array namespaces remain separate; scalar/array strings share
one family. Duplicate family names make semantic lookup ambiguous, not last-wins.

Validate bounds, tags, ASCII names, array extent/product/record length, terminator
and every five-byte numeric value. Share the numeric storage projection with
literal navigation rather than add a second floating-point interpretation.
Converted compiler literals retain their existing private validation boundary.
All numbers are projected from already stored 32-bit mantissas/exponents; no host
BASIC expression evaluation occurs. Strings retain all raw bytes, including CR,
NUL, token bytes and incomplete print-control packets. Display is escaped debug
text, not a claim that every runtime string can be written as source.

Malformed/unknown tables return explicit issues, retain owned bytes and any
known prefix records, and do not claim a complete semantic table. Do not scan for
a later plausible record or silently skip unknown lengths. Raw memory stays
available independently of semantic decoding, including at unmapped machine
pauses. A successful table is immutable; returned buffers cannot alias live
transport memory. Semantic interpretation requires the known original ROM,
coherent bounds and a current stop, and is discarded on resume/lifecycle changes.
No functions, expressions or user code are executed for inspection.

An independent fixture is produced by pinned zmakebas 1.3.3 plus actual original
48K ROM LOAD/RUN, without importing ZXCode. The sample creates a positive scalar,
negative long name, rounded fraction, raw-byte/empty strings, numeric/character
arrays and active FOR control. Captured VARS..E_LINE bytes are compared unchanged
by a separate reproduction script and by decoder fixtures. UI scopes/raw-memory
requests consume this API; screen/watch presentation belongs to M8-08.

The independent variable-layout tape retains zmakebas's hidden numeric bytes.
Those are not the definition of typed Sinclair literals: original-ROM DEC-TO-FP
stores `.5` as `7F 7F FF FF FF`, just below 1/2, while zmakebas supplied exact
1/2 in this layout fixture. The native ZXCode-built program correctly exposes the
ROM-entered value instead. Native checks use the existing independent numeric-ROM
fixture/020 contract for that distinction; no compiler or reference bytes were
changed to hide it. Number displays report the exact stored value, not an
approximation of the ROM PRINT routine's decimal presentation.

## Verified evidence

The reviewed independent table is 97 bytes and includes all six supported record
forms. Reproduction with the pinned zmakebas checkout and original ROM matches
`tests/fixtures/runtime-variables-rom.json` unchanged; no ZXCode module is imported
by that verifier. The local Node 24 suite passed 321 tests, including malformed
records, byte ownership, shared numeric projection, coherent stop checks, paged
views and raw-memory fallback. Reference example `.zxbas` files use pinned LF
checkout endings so source hashes are platform-independent.

Actual installed-VSIX scope/variable/readMemory requests passed numeric and string
scalars, FOR state, numeric array paging with exact ROM rounding, raw numeric
bytes and the read-only memory snapshot command. The retained
[native report](../evidence/m8-native-basic-variables.json) records those values.
Memory snapshots are explicitly historical after resume; semantic values are
invalidated on continued/stopped/lifecycle events and guarded by exact stop
identity before responses. Hosted checks remain required before merge.
