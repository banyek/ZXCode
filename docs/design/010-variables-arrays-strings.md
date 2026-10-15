# Variables, Arrays and String Slicing v0.1

Status: semantic/parser design baseline.

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
