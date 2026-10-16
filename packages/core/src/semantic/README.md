# Semantic analysis

Analysis and the validated BuildableProgram model live here. This layer may
consume source and syntax contracts; it must not import encoding, TAP, CLI, or
editor code. M1-03 defines artifact contracts and M1-06 implements validation.

`AnalyzedProgram<TProgram>` retains the immutable source snapshot, semantic
model, and diagnostics. `BuildableProgram<TProgram>` additionally requires a
private validation brand. Ordinary parsed/analyzed values cannot satisfy it.
M1-06 must introduce the validator here, after its fatal-diagnostic checks; no
public cast/unchecked builder is provided. Non-fatal diagnostics remain attached.

The generic model parameter lets M1-05/M1-06 define the actual syntax and semantic
node unions without guessing the grammar in this contracts-only ticket.
