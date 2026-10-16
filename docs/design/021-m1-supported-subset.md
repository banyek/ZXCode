# M1 syntax subset and recovery

M1-05 uses the smallest vertical slice rather than claiming full 48K grammar.
The hello program selected for M1-11 is:

```basic
10 PRINT "HELLO WORLD"
```

Supported statement shapes initially are `CLS`, `STOP`, and a dedicated `PRINT`
item stream: empty PRINT, or string/numeric literal expressions separated by
semicolon/comma, including a trailing separator. Colon separates statements.
The original manual's [chapter 2](https://worldofspectrum.org/ZXBasicManual/zxmanchap2.html)
documents string output, numeric output, PRINT separators, and multi-statement
lines; the ROM-derived [command grammar](005-command-grammar.md) establishes the
no-operand CLS/STOP forms. General expressions, variables, PRINT formatting and
other commands remain later coverage rather than permissive placeholders.

The lexer retains exact token text and ranges, including whitespace, colon
separators, and EOF insertion positions. Quoted content is one string token;
backslash and doubled quotes introduce no new escape convention. An unfinished
string retains its content and a closed=false marker with a syntax diagnostic.
At statement start REM enters a raw-tail mode, preventing colon/quote/keyword
text in the remainder from becoming ordinary tokens. REM is preserved for
editing but is not buildable in this initial subset; M2-14 owns its acceptance.

The CST keeps physical blank/invalid lines and the complete token stream for
numbered bodies. Statement dispatch creates dedicated PRINT/CLS/STOP nodes with
literal expression nodes and explicit PRINT separators. Unsupported or malformed
statements retain error nodes. Recovery resumes at colons outside strings/raw
tails, then at physical line boundaries. Empty statement slots and unsupported
forms receive explicit M1-coverage diagnostics rather than being silently encoded.

Semantic validation, numeric conversion, character representability and the
BuildableProgram boundary remain M1-06. Parsing never certifies binary safety.
New ROM statements and expression forms extend these same token/CST/statement
interfaces; there is no alternate build-only tokenizer or disposable hello path.
