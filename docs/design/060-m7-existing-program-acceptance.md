# M7 existing-program workflow acceptance

The representative existing tape uses the independently referenced arrays/functions
BASIC image, including arrays, strings, DATA/READ, RESTORE, FN, channels and IF.
The isolated native-host harness wraps those reference bytes as a tape, imports
through the actual CLI, and performs an explicit preserving rebuild. Require
complete original/preserved TAP identity before editor operations begin.

Open the imported source through the actual installed VSIX. Native definition,
reference and outline queries must navigate the imported FN correctly. Preview
renumbering to 100,200,...1000 without mutating text, explicitly Apply, verify the
RESTORE destination update, format through the native document provider, require
format idempotence, then Build TAP from the dirty buffer. Require no diagnostics.
The normal native smoke also covers workspace isolation, stale renumber rejection
and previewable diagnostic fixes. Keep original/preserved/transformed tapes,
import provenance, exact dirty source and native command audit in an empty caller
selected evidence directory.

The optional original-ROM check consumes those actual editor artifacts; it does
not rebuild a substitute source. Verify input artifact hashes and preserved tape
identity, then independently LOAD/CLS/RUN original and transformed tapes under
SkoolKit 10.1 with the pinned original 48K ROM and loader acceleration disabled.
Both must display `36wo`, `CORE OK` and successful ROM completion. The original
completion line is 100; the renumbered completion line is 1000. This is an explicit
observable numbering change within the renumber guarantee, not a claim of full
observational equivalence. The program's own IF checks array, FN, RESTORE and
string values before printing success.

Guarantees remain separate: unedited preserving rebuild has identical TAP bytes;
formatting has identical compiled BASIC bytes; renumbering preserves proven
literal destinations and stored order, with documented source/RAM observation
limits. After renumbering, use ordinary Build TAP. The old reference-based rebuild
must reject a changed BASIC image. Workspace files remain independent programs.

## Reproduction

```sh
npm run check
npm run test:existing -- --output /absolute/new-evidence-directory
PYTHONPATH=<skoolkit-10.1> python3 scripts/research/verify-existing-workflow-rom.py --evidence-dir /absolute/new-evidence-directory
```

The normal native suite runs in isolated VS Code profiles and installs the actual
VSIX. No ROM/emulator is packaged. Hosted three-platform checks remain a merge
gate; optional original-ROM research and local native checks do not bypass them.

## Verified evidence

Local Node 24 checks passed all 299 tests. Actual installed-VSIX workflow passed,
including refusal of a changed-program reference rebuild without creating output.
The original 382-byte tape and preserved tape have identical SHA-256; actual
native-editor output executes the expected CORE OK assertions at line 1000.
The retained [report](../evidence/m7-existing-workflow.json) records hashes and
original-ROM screen rows. Complete artifacts and logs remain in the selected
evidence directory. Hosted CI is externally unavailable; these local results
do not constitute passing hosted merge gates.
