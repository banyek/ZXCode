# Syntax

Physical-line scanning, lexer modes, recoverable CST, and parsing live here.
This layer may consume source/diagnostic contracts. It preserves original text
and ranges and must not import semantics, encoding, TAP, CLI, or editor code.
M1-04 and M1-05 supply the first implementation.
