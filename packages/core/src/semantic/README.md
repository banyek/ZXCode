# Semantic analysis

Analysis and the validated BuildableProgram model live here. This layer may
consume source and syntax contracts; it must not import encoding, TAP, CLI, or
editor code. M1-03 defines artifact contracts and M1-06 implements validation.

`AnalyzedProgram<TProgram>` retains the immutable source snapshot, semantic
model, and diagnostics. `BuildableProgram<TProgram>` additionally requires a
private validation brand. `analyzeBasic` issues it only after validation; runtime
identity checks reject edited/copied values. No public cast/unchecked builder is
provided. Non-fatal diagnostics remain attached.

The generic artifact contract coexists with the concrete M1 `BasicProgram` model.
Numeric tokens convert here once, and string content is checked against the
documented M1 character subset before encoding.
