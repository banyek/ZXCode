# TAP container

TAP block writing lives here. It consumes encoded bytes and explicit BASIC
metadata, independently of source, syntax, semantic analysis, and editor APIs.
`writeBasicTap` supplies the writer. Container wrapping must not interpret BASIC
grammar. `writeTapBlock` writes a length prefix, flag, payload, and XOR parity.

All metadata is explicit and filename bytes must already be encoded/padded to
ten bytes. See [the TAP contract](../../../../docs/design/019-tap-container.md)
for field provenance, limits, ownership, and independent unit-fixture derivation.
