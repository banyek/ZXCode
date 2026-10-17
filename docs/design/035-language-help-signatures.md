# M4 language help and signature metadata

Help is original concise wording over the authentic shared token catalogue,
command grammars and built-in signature table. It describes supported syntax; it
does not parse it. Built-in signature facts move to a source-layer module so
semantic validation, completion and help cannot acquire different arities/types.
Existing semantic exports remain compatible. Complex PRINT/INPUT, arrays, IF and
cassette grammar stays in parser code.

Primary provenance is the original Sinclair manual, particularly
[Appendix C](https://worldofspectrum.org/ZXBasicManual/zxmanappc.html),
[functions](https://worldofspectrum.org/ZXBasicManual/zxmanchap9.html),
[mathematics](https://worldofspectrum.org/ZXBasicManual/zxmanchap10.html),
[PRINT/INPUT](https://worldofspectrum.org/ZXBasicManual/zxmanchap15.html),
[colour](https://worldofspectrum.org/ZXBasicManual/zxmanchap16.html),
[graphics](https://worldofspectrum.org/ZXBasicManual/zxmanchap17.html),
[sound](https://worldofspectrum.org/ZXBasicManual/zxmanchap19.html),
[cassette](https://worldofspectrum.org/ZXBasicManual/zxmanchap20.html), and
[channels](https://worldofspectrum.org/ZXBasicManual/zxmanchap22.html).
The implemented grammar/ROM fixtures resolve manual shorthand, including empty FN
parentheses, open slices, native cassette forms and runtime capability stubs.
Interface 1-required commands remain documented with their supported native shape
and explicit capability note; the help does not promise added Interface 1 grammar.

Each command/function entry carries token identity, summary, concise syntax,
parameter facts where fixed, and provenance links. Optional notation in help is
explanatory, never inserted as a new source dialect. The same frozen documentation
is adapted for completion details and token hover. Hover consults semantic symbols
first, so keyword-looking variable names keep their identity; quoted/REM contents
remain opaque. Multiword commands are identified from parsed command structure.

Signature help uses the same prefix-CST function-argument context as completion,
shared builtin types and analyzer-bound DEF FN parameters. It returns structured
labels/parameters with active argument indices, not editor protocol spans or
rendering. Unknown/missing callees return no signature. Commands with complex item
streams get syntax/help documentation rather than invented fixed argument lists.

The original manual chapter links are retained per entry; the ROM capability
resolution is documented in [design 025](025-runtime-capability-policy.md).
Node 24 full validation passes 238 tests. The independent token fixture checks
complete 91-token coverage; all 27 built-in arity/result facts agree with semantic
validation. Tests cover shared hover/completion documentation, multiword commands,
keyword-looking variable precedence, opaque text, built-in/user FN argument help,
first-bound duplicate definitions and missing/incomplete-call behavior.
