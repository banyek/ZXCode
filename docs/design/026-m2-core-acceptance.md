# M2 BASIC-core acceptance

## Coverage boundary

All fifty original 48K ROM statement commands now have parser, semantic and
encoder paths. The combined/focused independent corpus checks every statement
command and all 27 built-in signatures, plus every accepted typed expression,
assignment target, PRINT item and INPUT item variant. Encoder dispatch has
compile-time exhaustiveness checks so a later semantic variant cannot silently
emit nothing. No unsupported syntax receives placeholder bytes.

Eight programs in `examples/core` combine arrays and string slicing, numeric/string
FN calls, READ/DATA/RESTORE, FOR/NEXT, nested IF tails and subroutines, all builtins,
graphics/sound, INPUT/PRINT presentation, cassette/listing forms, channels and raw
REM. Fixed expected program images are in `tests/fixtures/core-corpus.json`.
Source copies are checked against the examples; repeated builds and source-map
bounds are checked. Focused fixtures retain their original expected bytes.

M2 establishes broad command/grammar support, not completion of the M3 fidelity
work. Character/control/escape mapping, the full numeric lexical surface (including
ignored source whitespace inside numbers), lexical edge cases, import fidelity and
container hardening remain their explicit M3 tickets. Current source literals use
ASCII 32..126 except backtick. The documented 32 KiB build budget remains a tooling
coverage limit. Peripheral vocabulary uses the M2-16 runtime capability policy.

## Independent expected bytes

zmakebas 1.3.3 at commit 667090faf392e0083bbcf238084dcdd996957285 independently
produces the comparison images. Most corpus images agree byte for byte. Two cases
retain both its unmodified `comparisonHex` and the authoritative `programHex`,
with per-line primary-reference corrections recorded explicitly:

- Graphics line 30: decimal 0.1 uses the stored bytes observed by the original ROM
  DEC-TO-FP verifier (`numeric-rom.json`), not zmakebas's different rounding.
- REM/slices lines 10 and 30: exact source spaces/backslashes remain raw literal
  bytes, as established by `rem-rom.json`; zmakebas removes/decodes some of them.
- REM/slices line 40: empty BIN is zero in the original ROM, with its normal hidden
  numeric storage (`expression-rom.json` and `numeric-rom.json`); zmakebas omits it.

The standalone comparison verifier checks `comparisonHex` when present and never
rewrites fixtures. The original-ROM verifiers independently recheck the primary
observations. No golden was derived from ZXCode output or changed merely to make
a compiler test pass. The earlier empty DEF FN comparison-tool discrepancy remains
covered by the dedicated function fixtures.

## Original-ROM integration

`scripts/research/smoke-core.py --output-dir PATH` builds the arrays/functions
example through the real CLI. It independently verifies TAP framing/checksums and
the embedded program against the fixed comparison image, then uses SkoolKit 10.1
with the pinned original 48K ROM, real cassette LOAD/RUN, fast loading disabled
and loader accelerators disabled. The emulator is a test target, not language
specification. Python/SkoolKit/ROM are optional research dependencies, absent from
production and normal CI.

The snapshot must reach ROM 0x12AC with ERR_NR=FFh and screen report
`0 OK, 100:1`. Actual screen bitmap cells must show `CORE OK` and no `CORE FAIL`.
The program's own runtime conditions check numeric and string array contents,
RESTORE/READ results, numeric/string FN evaluation and slicing. OPEN #4 routes
output to the screen, CLOSE #4 must leave its stream entry zero, and numeric
formal storage must hold six. The loaded program must still match the independent
image except for the two specifically identified five-byte formal slots that the
ROM intentionally overwrites during FN evaluation.

Observed 2026-10-17: screen rows were `36wo`, `CORE OK`, and `0 OK, 100:1`;
PROG=23755; numeric formal bytes `0000060000`; stream 4 closed. Retained TAP,
snapshot, log, screen PNG and JSON evidence are produced in the requested output
directory, never tracked as generated binary assets.

## Validation

The supported Node 24 full check passes 156 tests (typechecking, lint, build and
tests). The independent eight-program comparison and original-ROM numeric,
expression and REM verifiers pass. M1's original hello fixture stays unchanged.
