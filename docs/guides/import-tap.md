# Import an existing BASIC TAP

Run `zxcode import existing.tap` to create `existing.zxbas` and
`existing.zxbas.import.json` beside the tape. Choose another source path with
`--output program.zxbas`. Both output paths must be new; import never overwrites
an existing file. Open the resulting `.zxbas` in VS Code as usual.

The importer accepts one BASIC header/data pair and validates tape lengths and
checksums. Source is accepted only when the shared compiler reproduces the entire
stored BASIC program image byte for byte. Unsupported tokenized/raw constructs,
noncanonical stored bytes, altered hidden numeric values and malformed records
are reported instead of silently converted to approximate source. No output is
written for a blocked import. Keep the original TAP for unsupported programs.

Saved runtime variables cannot be expressed by source declarations. Import blocks
such tapes by default. `zxcode import existing.tap --source-only` explicitly
imports just the proven BASIC image and reports how many saved-variable bytes it
omitted. The original tape stays untouched. This option does not restore saved
state when you build or run the source.

The provenance JSON records SHA-256 hashes of the original TAP, BASIC bytes and
emitted source, plus original filename bytes, autostart word, variables boundary
and omitted-variable count. It contains no timestamp or absolute input path.
The `.zxbas` file uses LF endings and canonical exported token spelling; original
editor spelling is not present in a tokenized tape. Ordinary Build TAP uses its
normal filename/autostart options; it does not silently consume import metadata.
This workflow guarantees the BASIC image, not an identical complete cassette or
runtime snapshot. No normalization mode or new BASIC syntax is introduced.

For an explicit binary-preserving rebuild, run:

```sh
zxcode rebuild imported.zxbas --reference original.tap --output preserved.tap
```

This requires the original tape and refuses any compiled BASIC-byte change.
It copies original filename/autostart metadata and opaque saved-variable bytes,
then checks the complete rebuilt TAP against the reference. The output must be
new. Source whitespace/case changes can pass when compiled bytes stay identical;
changing a numeric spelling may change stored bytes even if its value is equal.
Use ordinary Build TAP for an edited program. Provenance JSON alone is not a
binary reference or saved-state cache.
