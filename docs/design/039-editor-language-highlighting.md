# M5 language registration and highlighting

The registered id is `zx-spectrum-basic`, displayed as ZX Spectrum BASIC. The
unambiguous `.zxbas` extension selects it automatically. Generic `.bas` is not
claimed globally because many unrelated BASIC dialects use that suffix. Existing
`.bas` files remain first-class Spectrum sources: select the language explicitly
or opt in through workspace `files.associations`. This repository opts in for its
own `.bas` examples/fixtures only. Filename extensions change no source grammar.

The contributed TextMate scope is `source.zx-spectrum-basic`, following the
[official highlighting model](https://code.visualstudio.com/api/language-extensions/syntax-highlight-guide)
and [language contribution contract](https://code.visualstudio.com/api/references/contribution-points#contributes.languages).
The visual grammar describes line numbers, authentic catalogue words, quoted
strings/doubled quotes, numeric spellings and REM rest-of-line regions. String
and comment rules precede keyword/number rules. Statement-start regions after a
number, colon or THEN allow REM without treating a LET target named rem as a
comment. Unterminated strings end at the physical line for editor recovery.

Keyword vocabulary is generated from the shared ROM catalogue into checked-in
JSON. The generator is explicit and tests reject drift; normal builds do not
rewrite source assets. Visual matching can approximate awkward/incomplete text;
it never validates, tokenizes, rewrites or builds BASIC. The shared core remains
the sole language acceptance authority, with no dependency on TextMate/editor data.
Source escape spans are highlighted as transport notation without a second escape
validator. No labels, WHILE/WEND, implicit numbers, alternate power operator or
other BASIC dialect is introduced by highlighting.

A minimal language configuration pairs parentheses/quotes and excludes text/comment
scopes from bracket matching. It deliberately has no comment-toggle rule: blindly
prefixing REM before a required BASIC line number would corrupt source. Genuine
comment-editing actions require a later parser-aware command.

Tests use pinned vscode-textmate 9.3.2 and vscode-oniguruma 2.0.1, the actual
Microsoft tokenization libraries, to check scopes and physical-line recovery.
The real-host smoke checks registration, automatic `.zxbas` selection and explicit
`.bas` language mode without changing a user's global associations.

Validation passes 250 Node 24 tests. Real TextMate/Oniguruma probes cover native
word/stream/dollar-function scopes, numeric lexical spellings, REM context, doubled
quotes, escapes and recovery on the next physical line. The isolated VS Code
host confirms automatic .zxbas language selection/activation, no global .bas claim,
and explicit .bas language selection; the existing adapter smoke remains green.
