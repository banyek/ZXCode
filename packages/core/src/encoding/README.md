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
All source ranges belong to the encoded program's source snapshot.
`encodeBasicProgram` validates its input and byte bounds and emits those mappings.
Numeric emission consumes the semantic converter's checked storage without
reparsing its source lexeme. See the M1 encoding and numeric design contracts.

Source mappings do not promise that a runtime BASIC address corresponds to a
fixed Z80 program counter; M8 still requires its independent feasibility proof.
