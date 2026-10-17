# M7 formatter policy

Decision: the initial formatter is a conservative whole-document whitespace
canonicalizer, backed by the same parser and encoder as builds. This settles the
M7-03 design gate before implementation. It adds no language syntax.

Require a buildable input and produce immutable source edits bound to its exact
snapshot identity. Invalid/incomplete programs return a blocked operation, with
no partial formatting. Preserve physical line order, blank-line count and every
physical terminator (including mixed LF/CRLF/CR and the absence of a final newline).
Preserve line-number spelling, including leading zeros. Remove indentation before
a declaration and use one ASCII space between the number and its body. Empty
physical lines lose only their ASCII space/tab padding.

Within a valid body, collapse existing lexer whitespace tokens to one ASCII
space; drop trailing whitespace tokens. Do not insert spaces where none existed,
rewrite operators, reflow statements or sort lines. All keyword and identifier
case is preserved. There is deliberately no uppercase option in this first
policy: case and keyword-looking name handling remain the shared parser's concern.
Numeric tokens, including embedded spaces accepted by the ROM numeric grammar,
are copied intact. String token spelling, doubled quotes, Unicode and escape
spellings are copied intact. REM's complete raw tail is opaque, including leading
and trailing whitespace and keyword-looking text. Never trim a REM tail as if it
were ordinary whitespace. Formatting has no line-length or indentation option.

Encode both the original and the proposed complete source through the shared
pipeline and require byte-for-byte identical BASIC program images. This is a
mandatory production guard, not just a test. A failed parse, encoding budget or
byte comparison returns a blocked result with no edits. Do not silently fall back
to a different normalization or bless changed reference bytes. The guarantee is
identical compiled BASIC bytes, stronger than plausible runtime equivalence.
Original source spelling itself can of course change in the explicitly specified
whitespace positions.

Return disjoint complete physical-content edits, preserving terminators. The
VS Code whole-document formatting provider delegates to this operation and checks
the live snapshot after the query; VS Code owns the version-bound format edit
transaction. There is no range-formatting provider: partial invalid syntax must
not accidentally acquire a proof. Repeating formatting must produce identical
text and no edits. Regressions cover byte equality, idempotence, mixed terminators,
opaque REM/string bytes, spaced numeric literals, names and invalid input.
