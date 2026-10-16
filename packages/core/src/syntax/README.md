# Syntax

Physical-line scanning, lexer modes, recoverable CST, and parsing live here.
This layer may consume source/diagnostic contracts. It preserves original text
and ranges and must not import semantics, encoding, TAP, CLI, or editor code.
`scanPhysicalLines` implements the M1-04 header contract in
[the source-format design](../../../../docs/design/011-text-source-format.md).
Its `ParsedDocument<PhysicalProgram>` preserves every physical line, including
blank and recoverable invalid nodes, in file order. Numbered nodes retain number,
body, whole-line, content, and line-ending ranges. M1-05 supplies body parsing;
the scanner does not tokenize strings, REM, or statement separators.
