# Variables, Arrays and String Slicing v0.1

Status: M2-03 naming/identity contract below; array/slice grammar remains later work.

## Spectrum naming is type-bearing

ZX Spectrum BASIC variable spelling carries semantic information. ZXCode should model variable kind explicitly instead of storing every identifier as an undifferentiated name.

Required categories include:

- numeric scalar;
- string scalar;
- numeric array;
- string array;
- FOR/NEXT control variable;
- DEF FN formal/user-function names.

The exact lexical naming rules are to be encoded from the manual/ROM and tested independently.

## Numeric variables

Numeric variable names may have Spectrum-specific naming/spacing rules that differ from modern identifier grammars. Source normalization must not accidentally change the program's identity.

The semantic model should maintain a canonical Spectrum identity plus original source spelling.

## String variables

A trailing `$` marks string identity and affects expression type.

```basic
10 LET A$="HELLO"
20 PRINT A$
```

## Arrays

Numeric array access:

```basic
10 DIM A(10,10)
20 LET A(2,3)=42
```

String arrays require distinct modelling because a subscripted string-array element may itself participate in string slicing.

Suggested semantic symbol:

```text
VariableSymbol
  canonicalName
  sourceName
  valueType: Numeric | String
  storageKind: Scalar | Array
  dimensions?: number
```

## String slicing

Spectrum BASIC supports substring selection using `TO` inside string indexing syntax.

Conceptual examples:

```basic
A$(2)
A$(2 TO 5)
A$( TO 5)
A$(2 TO )
```

The ROM expression scanner also documents compound cases such as a string-array element followed by slicing.

This means `TO` has at least two contextual grammatical roles:

- FOR range syntax;
- string slicing syntax.

It must not be represented as a generic binary operator.

Suggested node:

```text
StringSlice
  base: StringExpression
  start?: NumericExpression
  end?: NumericExpression
```

Array subscripts remain distinct from slice bounds.

## Assignment targets

LET requires an assignable target, not an arbitrary expression.

Possible target nodes:

```text
NumericVariableTarget
StringVariableTarget
NumericArrayElementTarget
StringArrayElementTarget
StringSliceTarget   // verify exact assignability rules
```

INPUT and READ can reuse the semantic concept of assignability while retaining their own statement grammars.

## Symbols and editor intelligence

Once variable identity rules are frozen, the semantic model can provide:

- completion from variables already used/declared;
- hover with inferred kind/type;
- references;
- warnings for suspicious dimension/use mismatches;
- DEF FN navigation.

Avoid warnings based on modern declaration-before-use expectations: Spectrum BASIC permits usage patterns unlike statically declared languages.

## Verification fixtures

Create fixtures for:

- long numeric variable names and spaces;
- string names;
- scalar vs array use;
- multidimensional numeric arrays;
- string arrays;
- every open/closed slice-bound form;
- nested string-array-element + slice cases;
- LET assignment to supported string targets;
- malformed subscripts and slices.

## M2-03 naming and identity contract

Sources: original Sinclair BASIC Programming [chapter 7](https://worldofspectrum.org/ZXBasicManual/zxmanchap7.html)
(naming/case/spacing), [chapter 12](https://worldofspectrum.org/ZXBasicManual/zxmanchap12.html)
(array naming and coexistence), and [chapter 9](https://worldofspectrum.org/ZXBasicManual/zxmanchap9.html)
(FN and formal parameter names). The original ROM LOOK-VARS routine at 0x28B2
independently confirms the name boundary; fixed observations and a standalone
verifier record how many source bytes it consumes in syntax mode.

- Numeric scalars begin with an ASCII letter, then contain ASCII letters/digits.
  ASCII spaces are ignored for identity. Original spelling and source range remain
  unchanged; canonical names use lowercase ASCII without spaces.
- String scalars and string arrays have one ASCII letter followed by `$`; spaces
  between the letter and `$` do not affect identity. Longer `$` names are invalid.
- Numeric arrays and FOR/NEXT control variables have one ASCII letter. A control
  variable refers to the same numeric scalar identity; a numeric array has its own
  family, distinct from the scalar with the same letter.
- String scalars and arrays have a shared string identity family. The category
  records the use without creating two different string variables.
- FN names and formal parameter names have one letter, optionally followed by `$`.
  Function and formal identities have distinct families; formal keys are local
  to a definition and must be scoped by the later FN binder (M2-13).
- No underscores, Unicode case folding, leading digits, `%`, or multi-letter
  string/array names are introduced. Ordinary long numeric names are not truncated.
- Tabs in source are formatting, equivalent to source spaces outside literal/raw
  content; they are not encoded as a tab byte inside a variable name. This extends
  the existing text-file formatting policy, not ROM character naming rules.

### Text token boundaries

The ROM stores keyword tokens separately from raw name letters. The textual
parser recognizes AND/OR and statement delimiters THEN/TO/STEP at complete word
boundaries; these stop a name. Embedded keyword substrings stay letters. Once a
name has started, other keyword-looking words are name letters rather than prefix
functions: `some SIN name` is the numeric name `somesinname`. At expression start,
function/value prefixes retain their established grammar roles. Statement tokens
in an expression position may instead be raw variable letters (`PRINT PRINT`).
The identity API itself validates raw spelling independently of keyword context.
No global replacement of keyword-looking text occurs, and the encoder must use
semantic name identity rather than annotated lexer keyword tokens.

A name may consume only part of a provisional numeric lexer token: in `a 1e+2`,
LOOK-VARS consumes the name `a1e`, leaving `+2` as the expression continuation.
The parser must preserve this boundary rather than interpret the middle of a name
as a decimal exponent. Numeric-literal diagnostics therefore belong to literal
parsing, after context is known. Original lexer tokens remain lossless in the line
CST; the expression cursor may split a provisional token for grammar purposes.

Arrays, slices, assignment targets and FN calls remain the dedicated later issues.
No declaration-before-use warning or new compile-time storage allocation is added.

## M2-06 scalar assignment contract

Original Sinclair [Appendix C, LET](https://worldofspectrum.org/ZXBasicManual/zxmanappc.html)
requires explicit LET and assigns an expression value to a variable. M2-06 adds
numeric/string scalar targets only, reusing the frozen M2-03 naming identity and
M2-04 expression type rules. The right-hand result must match the target's type.
No declaration, implicit LET, expression-as-target or synthetic conversion exists.

Assignment targets have their own recoverable union, separate from expressions.
A shared scalar-target node retains checked identity and source range; error
nodes retain offending tokens. Array/slice targets can extend this union in
M2-11 and will also serve INPUT/READ rather than forcing a separate target grammar
in each statement. Authentic array/slice-shaped targets currently receive an
explicit coverage diagnostic; arithmetic/function/group expressions on the left
receive syntax diagnostics.

LET's top-level equals sign separates target and value. Equals signs inside a
parenthesized future target do not become assignment delimiters. The right-hand
side uses the same expression parser, so `LET a=b=1` assigns a numeric comparison.
In target position the name's raw letters are unambiguous before `=`; keyword-
looking names are checked as names, never globally tokenized. Spelling/case/spaces
remain in source, while emitted scalar names use their canonical ASCII identity.
Missing equals signs, incomplete values and trailing tokens remain unbuildable
even with parser diagnostics removed. The encoder emits LET + checked target +
`=` + validated expression; independent reference images cover both scalar types.

## M2-11 array, slicing and assignability contract

Original Sinclair manual chapters [8](https://worldofspectrum.org/ZXBasicManual/zxmanchap8.html)
and [12](https://worldofspectrum.org/ZXBasicManual/zxmanchap12.html), ROM
[STK-VAR](https://skoolkit.ca/disassemblies/rom/hex/asm/2996.html) and
[SLICING](https://skoolkit.ca/disassemblies/rom/hex/asm/2A52.html), plus fixed
original-ROM syntax observations settle the remaining grammar boundary.

- Numeric array names have one letter and at least one numeric subscript. They
  have a distinct identity family from numeric scalars. Multiple subscripts are
  allowed; empty groups, TO slices and repeated numeric-result groups are invalid.
- A named string's first group may have multiple numeric subscripts and an optional
  final slice. Runtime storage determines whether a single subscript refers to a
  scalar string character or a string-array element; static analysis must not guess
  an array declaration or dimension count from that ambiguous spelling.
- String slicing accepts one numeric selector, an empty whole-string selector,
  or optional start TO optional finish. A slice must be final in its group. A
  trailing empty selector is authentic for a named string array (`a$(i,)`); an
  empty selector before another comma is not. Literal/other string expressions and
  later repeated groups allow only one selector. `a$()` and `a$( TO )` retain
  distinct source spellings/bytes, with runtime defaults left to the ROM.
- Postfix groups bind to primaries before deferred prefix functions. Ordinary
  prefix string results need parentheses before slicing; SCREEN$'s dedicated pair
  primary may be sliced directly. This follows the scanner's special continuations,
  not another BASIC's function-call grammar.
- Assignable indexed targets must start with a variable name. Numeric array
  elements and named-string array/slice chains are allowed, including repeated
  string slices. Literal, arithmetic, function-result and parenthesized-expression
  bases cannot become assignment targets merely because they have string type.
  LET, INPUT and later READ share the same extended target union/validator.
- DIM accepts one single-letter array name (optional `$`) and one nonempty numeric
  dimension group, without TO or repeated groups. A string DIM's final dimension
  is character length. Numeric dimensions/subscripts/bounds are expressions; no
  new constant integer/range, declaration-before-use or shape-allocation rule is
  introduced. Runtime dimension/value errors remain runtime behaviour.

Shared selector/group containers retain source ranges, optional bounds and exact
TO/empty distinctions. Expression and target typing use one access validator;
encoding emits checked semantic selectors without materializing default bounds,
padding strings, allocating arrays or reparsing source. Existing temporary array/
slice target coverage guards from M2-06/M2-10 are superseded by this implementation.
Malformed group delimiters and selectors remain intrinsically incomplete after
parser diagnostics are removed. Independent ROM fixtures include assignability
boundaries and independent program images cover open bounds and multidimensional
forms. Numeric-whitespace lexical variants remain a separate corpus audit item;
this ticket does not silently broaden the already frozen decimal token spelling.
