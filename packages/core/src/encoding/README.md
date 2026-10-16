# Spectrum BASIC encoding

Numeric encoding and BuildableProgram-to-EncodedProgram conversion live here.
This layer consumes validated semantic and source contracts, preserving mappings
from source ranges to encoded bytes. It must not parse raw source or import TAP,
CLI, or editor code. M1-07 establishes numeric evidence; M1-08 adds the encoder.
