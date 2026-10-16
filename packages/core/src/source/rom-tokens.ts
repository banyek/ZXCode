/** Original 48K ROM vocabulary; categories are lexical roles, not grammar rules. */
export type RomTokenCategory = "value" | "function" | "print-control" | "literal-prefix" | "operator" | "syntax" | "statement";

export interface RomToken {
  readonly byte: number;
  readonly spelling: string;
  readonly category: RomTokenCategory;
}

export const ROM_TOKENS: readonly RomToken[] = Object.freeze([
  Object.freeze({ byte: 0xa5, spelling: "RND", category: "value" }),
  Object.freeze({ byte: 0xa6, spelling: "INKEY$", category: "value" }),
  Object.freeze({ byte: 0xa7, spelling: "PI", category: "value" }),
  Object.freeze({ byte: 0xa8, spelling: "FN", category: "function" }),
  Object.freeze({ byte: 0xa9, spelling: "POINT", category: "function" }),
  Object.freeze({ byte: 0xaa, spelling: "SCREEN$", category: "function" }),
  Object.freeze({ byte: 0xab, spelling: "ATTR", category: "function" }),
  Object.freeze({ byte: 0xac, spelling: "AT", category: "print-control" }),
  Object.freeze({ byte: 0xad, spelling: "TAB", category: "print-control" }),
  Object.freeze({ byte: 0xae, spelling: "VAL$", category: "function" }),
  Object.freeze({ byte: 0xaf, spelling: "CODE", category: "function" }),
  Object.freeze({ byte: 0xb0, spelling: "VAL", category: "function" }),
  Object.freeze({ byte: 0xb1, spelling: "LEN", category: "function" }),
  Object.freeze({ byte: 0xb2, spelling: "SIN", category: "function" }),
  Object.freeze({ byte: 0xb3, spelling: "COS", category: "function" }),
  Object.freeze({ byte: 0xb4, spelling: "TAN", category: "function" }),
  Object.freeze({ byte: 0xb5, spelling: "ASN", category: "function" }),
  Object.freeze({ byte: 0xb6, spelling: "ACS", category: "function" }),
  Object.freeze({ byte: 0xb7, spelling: "ATN", category: "function" }),
  Object.freeze({ byte: 0xb8, spelling: "LN", category: "function" }),
  Object.freeze({ byte: 0xb9, spelling: "EXP", category: "function" }),
  Object.freeze({ byte: 0xba, spelling: "INT", category: "function" }),
  Object.freeze({ byte: 0xbb, spelling: "SQR", category: "function" }),
  Object.freeze({ byte: 0xbc, spelling: "SGN", category: "function" }),
  Object.freeze({ byte: 0xbd, spelling: "ABS", category: "function" }),
  Object.freeze({ byte: 0xbe, spelling: "PEEK", category: "function" }),
  Object.freeze({ byte: 0xbf, spelling: "IN", category: "function" }),
  Object.freeze({ byte: 0xc0, spelling: "USR", category: "function" }),
  Object.freeze({ byte: 0xc1, spelling: "STR$", category: "function" }),
  Object.freeze({ byte: 0xc2, spelling: "CHR$", category: "function" }),
  Object.freeze({ byte: 0xc3, spelling: "NOT", category: "operator" }),
  Object.freeze({ byte: 0xc4, spelling: "BIN", category: "literal-prefix" }),
  Object.freeze({ byte: 0xc5, spelling: "OR", category: "operator" }),
  Object.freeze({ byte: 0xc6, spelling: "AND", category: "operator" }),
  Object.freeze({ byte: 0xc7, spelling: "<=", category: "operator" }),
  Object.freeze({ byte: 0xc8, spelling: ">=", category: "operator" }),
  Object.freeze({ byte: 0xc9, spelling: "<>", category: "operator" }),
  Object.freeze({ byte: 0xca, spelling: "LINE", category: "syntax" }),
  Object.freeze({ byte: 0xcb, spelling: "THEN", category: "syntax" }),
  Object.freeze({ byte: 0xcc, spelling: "TO", category: "syntax" }),
  Object.freeze({ byte: 0xcd, spelling: "STEP", category: "syntax" }),
  Object.freeze({ byte: 0xce, spelling: "DEF FN", category: "statement" }),
  Object.freeze({ byte: 0xcf, spelling: "CAT", category: "statement" }),
  Object.freeze({ byte: 0xd0, spelling: "FORMAT", category: "statement" }),
  Object.freeze({ byte: 0xd1, spelling: "MOVE", category: "statement" }),
  Object.freeze({ byte: 0xd2, spelling: "ERASE", category: "statement" }),
  Object.freeze({ byte: 0xd3, spelling: "OPEN #", category: "statement" }),
  Object.freeze({ byte: 0xd4, spelling: "CLOSE #", category: "statement" }),
  Object.freeze({ byte: 0xd5, spelling: "MERGE", category: "statement" }),
  Object.freeze({ byte: 0xd6, spelling: "VERIFY", category: "statement" }),
  Object.freeze({ byte: 0xd7, spelling: "BEEP", category: "statement" }),
  Object.freeze({ byte: 0xd8, spelling: "CIRCLE", category: "statement" }),
  Object.freeze({ byte: 0xd9, spelling: "INK", category: "statement" }),
  Object.freeze({ byte: 0xda, spelling: "PAPER", category: "statement" }),
  Object.freeze({ byte: 0xdb, spelling: "FLASH", category: "statement" }),
  Object.freeze({ byte: 0xdc, spelling: "BRIGHT", category: "statement" }),
  Object.freeze({ byte: 0xdd, spelling: "INVERSE", category: "statement" }),
  Object.freeze({ byte: 0xde, spelling: "OVER", category: "statement" }),
  Object.freeze({ byte: 0xdf, spelling: "OUT", category: "statement" }),
  Object.freeze({ byte: 0xe0, spelling: "LPRINT", category: "statement" }),
  Object.freeze({ byte: 0xe1, spelling: "LLIST", category: "statement" }),
  Object.freeze({ byte: 0xe2, spelling: "STOP", category: "statement" }),
  Object.freeze({ byte: 0xe3, spelling: "READ", category: "statement" }),
  Object.freeze({ byte: 0xe4, spelling: "DATA", category: "statement" }),
  Object.freeze({ byte: 0xe5, spelling: "RESTORE", category: "statement" }),
  Object.freeze({ byte: 0xe6, spelling: "NEW", category: "statement" }),
  Object.freeze({ byte: 0xe7, spelling: "BORDER", category: "statement" }),
  Object.freeze({ byte: 0xe8, spelling: "CONTINUE", category: "statement" }),
  Object.freeze({ byte: 0xe9, spelling: "DIM", category: "statement" }),
  Object.freeze({ byte: 0xea, spelling: "REM", category: "statement" }),
  Object.freeze({ byte: 0xeb, spelling: "FOR", category: "statement" }),
  Object.freeze({ byte: 0xec, spelling: "GO TO", category: "statement" }),
  Object.freeze({ byte: 0xed, spelling: "GO SUB", category: "statement" }),
  Object.freeze({ byte: 0xee, spelling: "INPUT", category: "statement" }),
  Object.freeze({ byte: 0xef, spelling: "LOAD", category: "statement" }),
  Object.freeze({ byte: 0xf0, spelling: "LIST", category: "statement" }),
  Object.freeze({ byte: 0xf1, spelling: "LET", category: "statement" }),
  Object.freeze({ byte: 0xf2, spelling: "PAUSE", category: "statement" }),
  Object.freeze({ byte: 0xf3, spelling: "NEXT", category: "statement" }),
  Object.freeze({ byte: 0xf4, spelling: "POKE", category: "statement" }),
  Object.freeze({ byte: 0xf5, spelling: "PRINT", category: "statement" }),
  Object.freeze({ byte: 0xf6, spelling: "PLOT", category: "statement" }),
  Object.freeze({ byte: 0xf7, spelling: "RUN", category: "statement" }),
  Object.freeze({ byte: 0xf8, spelling: "SAVE", category: "statement" }),
  Object.freeze({ byte: 0xf9, spelling: "RANDOMIZE", category: "statement" }),
  Object.freeze({ byte: 0xfa, spelling: "IF", category: "statement" }),
  Object.freeze({ byte: 0xfb, spelling: "CLS", category: "statement" }),
  Object.freeze({ byte: 0xfc, spelling: "DRAW", category: "statement" }),
  Object.freeze({ byte: 0xfd, spelling: "CLEAR", category: "statement" }),
  Object.freeze({ byte: 0xfe, spelling: "RETURN", category: "statement" }),
  Object.freeze({ byte: 0xff, spelling: "COPY", category: "statement" }),
 ]);

const byByte = new Map(ROM_TOKENS.map((token) => [token.byte, token]));
const bySpelling = new Map(ROM_TOKENS.map((token) => [token.spelling, token]));

export function romTokenByByte(byte: number): RomToken | undefined {
  return byByte.get(byte);
}

export function romTokenBySpelling(spelling: string): RomToken | undefined {
  // Restrict case folding to the source language's ASCII alphabet.
  return bySpelling.get(spelling.replace(/[a-z]/g, (letter) => letter.toUpperCase()));
}
