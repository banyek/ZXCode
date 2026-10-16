# Syntax

Physical-line scanning, lexer modes, recoverable CST, and parsing live here.
This layer may consume source/diagnostic contracts. It preserves original text
and ranges and must not import semantics, encoding, TAP, CLI, or editor code.
`scanPhysicalLines` implements the M1-04 header contract in
[the source-format design](../../../../docs/design/011-text-source-format.md).
Its `ParsedDocument<PhysicalProgram>` preserves every physical line, including
blank and recoverable invalid nodes, in file order. Numbered nodes retain number,
body, whole-line, content, and line-ending ranges. `parseBasic` adds the lexer/CST
and dedicated statement/literal nodes for the documented M1 subset. Its lexer
preserves quoted content and REM raw tails; parser recovery retains error nodes.
The physical scanner itself does not tokenize bodies.
