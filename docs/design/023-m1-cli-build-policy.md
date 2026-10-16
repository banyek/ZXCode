# M1 check/build orchestration and CLI policy

M1-10 exposes one host-independent core pipeline: parse, analyze, encode, then
optionally wrap TAP. Check performs encoding validation (including size limits)
but emits no TAP. Build uses the same checks and refuses fatal diagnostics.
The CLI only handles arguments, strict UTF-8 input, diagnostic rendering, and
filesystem output; it contains no alternate BASIC parser or encoder.

The following previously open M1 build defaults are explicit decisions:

- `zxcode check <file>` writes diagnostics and succeeds only when the supported
  source is buildable. It creates no output file.
- `zxcode build <file>` writes beside the source, replacing its final extension
  with `.tap` (or appending `.tap` when there is no extension).
- `--output <path>` / `-o <path>` selects a destination relative to the current
  working directory. A successful build replaces an existing artifact. Invalid
  input leaves existing artifacts untouched. Source-file destinations, including
  existing symlink/hardlink aliases, are refused.
- The Spectrum header name defaults to the source basename without its extension.
  `--name <name>` overrides it. Names require 1..10 directly representable M1
  characters (ASCII 32..126 except backtick/code 96) and are padded with spaces.
  Overlong/unrepresentable names fail; they are not truncated or transliterated.
- Builds default to no autostart, represented explicitly by header word 8000h.
  `--autostart <line>` accepts decimal 1..9999. It selects metadata, not language
  syntax or a guarantee that the target line exists.
- The variables offset is the encoded BASIC image length: M1 emits no saved
  runtime variables. Filename/autostart metadata does not affect BASIC image bytes.
- Exit codes are 0 for success, 1 for source/build/I/O failure, and 2 for invalid
  command usage/options. Diagnostics show file, one-based line/column, severity,
  stable code, category and message, with related information when present.
- Source bytes are decoded as UTF-8 with fatal decoding errors. A BOM is retained
  as source text; no Unicode whitespace or characters are silently normalized.

These defaults do not freeze future fidelity/import conventions or emulator APIs.
