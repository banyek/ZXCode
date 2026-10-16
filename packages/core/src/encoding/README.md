# Spectrum BASIC encoding

Numeric encoding and BuildableProgram-to-EncodedProgram conversion live here.
This layer consumes validated semantic and source contracts, preserving mappings
from source ranges to encoded bytes. It must not parse raw source or import TAP,
CLI, or editor code. M1-07 establishes numeric evidence; M1-08 adds the encoder.

`BasicProgramEncoder<TProgram>` accepts only a branded `BuildableProgram`.
`EncodedProgram` retains source identity, bytes, line mappings and statement
mappings. Offsets start at the beginning of the BASIC image, excluding TAP data.
Line offset/length includes the encoded line header and terminator; statement
offset/length describes the emitted statement bytes where correlation is known.
An omitted statement byte range means no reliable mapping, not offset zero.
All source ranges must belong to the encoded program's source snapshot. M1-08
must validate byte bounds and produce these mappings with its authentic output.

These are data contracts, not an encoder implementation or a promise that a
runtime BASIC address corresponds to a fixed Z80 program counter.
