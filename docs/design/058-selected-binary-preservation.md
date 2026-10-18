# M7 selected binary-preserving rebuild

Decision: add an explicit reference-based rebuild, separate from ordinary Build
TAP. The M3 independent corpus and strict product importer establish the selected
subset: one valid type-zero BASIC header/data pair whose complete BASIC program
image has an exact source export. Do not broaden the decoder, normalize hidden
numeric values or treat arbitrary TAP layouts as editable BASIC.

`rebuildPreservedTap(source, referenceTape)` must validate the original reference
through the product importer with the explicit source-only inspection policy,
compile the supplied source and compare every BASIC byte with the reference's
program portion. Different source whitespace/case is acceptable only if compiled
bytes remain identical. Any program change, invalid source, unsupported reference
or malformed framing returns a blocked operation without an output artifact.

On success, reuse the original filename bytes, autostart word, variables boundary
and opaque saved-variable suffix. The variables are copied from the reference,
not inferred, decoded or recreated from source. Serialize with the shared TAP
writer, then require equality with the complete original reference TAP before
returning the `identical-tap-bytes` guarantee. Copy input buffers at the boundary.
The final comparison also protects the narrower BASIC-program guarantee and
prevents a future writer/container change from falsely claiming preservation.

CLI: `zxcode rebuild source.zxbas --reference original.tap [-o preserved.tap]`.
The reference is mandatory; ordinary import provenance JSON is descriptive, not
a trusted binary cache. Default output is `source.preserved.tap`. Create only a
new output file, after all checks pass; never overwrite source, reference or an
existing path/alias. Report the count of copied variable bytes. An edited program
must use ordinary Build TAP with explicitly chosen metadata instead.

This workflow can preserve variables because it retains their original bytes;
that does not make the source alone a saved-state format. It does not claim that
reloading a preserved runtime state is appropriate after arbitrary source edits:
those edits are rejected unless the entire BASIC image is unchanged. No ROM,
emulator executable, raw numeric override, snapshot format or multi-file cassette
support is introduced. Regression cases include all pinned core images, opaque
variables, original metadata words, changed numeric spellings, malformed/raw
records and exclusive output protection.
