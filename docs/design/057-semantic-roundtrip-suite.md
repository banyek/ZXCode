# M7 semantic round-trip acceptance

Supported editable import remains the exact BASIC-image subset defined in 056.
There is no lossy program normalization mode. Therefore byte identity establishes
preservation of every stored statement, literal number, REM byte and destination
before runtime; a separate execution check verifies the product workflow on an
explicit subset rather than using an emulator as grammar authority.

Normal CI runs a TAP -> product import -> shared build -> TAP suite for all eight
independently referenced core corpus images. It compares complete BASIC payloads,
checks repeat-import idempotence and confirms the declared normalization boundary:
source spelling is reconstructed and cassette filename/autostart metadata may
change only through explicit build options. Saved variables are excluded by the
default importer; source-only consent is tested separately in 056's suite.

Optional original-ROM execution covers arrays-functions (arrays, DATA/READ,
RESTORE, FN, channels and control flow) and escapes (raw REM, controls/graphics,
quotes and text). The harness creates original/rebuilt tapes through the real CLI
import/build commands, then independently loads and runs each in fresh SkoolKit
10.1 machines using the SHA-pinned original 48K ROM. Loader acceleration is off.
The loader command clears its loading display before RUN, so a different cassette
filename is an allowed container normalization, not an accidental screen mismatch.

Require expected success markers/ROM completion, identical screen bytes, identical
post-run program bytes (including runtime FN slots), and identical saved-variable
regions for each original/rebuilt pair. Runtime state is observed, not regenerated
as source. Keep tapes, imported source/provenance, snapshots, logs and a JSON
report in the requested evidence directory. No ROM is committed.

The full eight-program corpus includes cassette/hardware operations and graphics;
it is not claimed to execute unattended under this runtime harness. Normal CI
requires no external emulator or ROM. This ticket does not broaden import syntax
or promise arbitrary saved-state/binary cassette preservation.

## Reproduction and verified evidence

Run `npm run test:roundtrip` under Node 24 for the normal corpus gate. Optional:

```sh
PYTHONPATH=<skoolkit-10.1> python3 scripts/research/verify-roundtrip-rom.py --output-dir <new-evidence-directory>
```

The local original-ROM run passed both pairs: CORE OK / 0 OK, 100:1 and
ESCAPES OK / 0 OK, 40:1. All three runtime regions matched byte for byte.
The retained [report](../evidence/m7-roundtrip-rom.json) records the actual hashes.
Complete tapes, provenance, snapshots and logs remain in the requested evidence
directory; the committed report contains no ROM or machine-specific paths.
