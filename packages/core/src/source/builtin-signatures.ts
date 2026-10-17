import { romTokenBySpelling } from "./rom-tokens.js";
import type { RomToken } from "./rom-tokens.js";

export type ExpectedExpressionType = "numeric" | "string" | "numeric-or-string";
export interface BuiltinSignature {
  readonly token: RomToken;
  readonly arguments: readonly ExpectedExpressionType[];
  readonly result: "numeric" | "string";
}
const signature = (name: string, args: readonly ExpectedExpressionType[], result: "numeric" | "string"): BuiltinSignature => Object.freeze({ token: romTokenBySpelling(name)!, arguments: Object.freeze([...args]), result });
export const BUILTIN_SIGNATURES: readonly BuiltinSignature[] = Object.freeze([
  signature("RND", [], "numeric"), signature("PI", [], "numeric"), signature("INKEY$", [], "string"),
  ...["POINT", "ATTR"].map((name) => signature(name, ["numeric", "numeric"], "numeric")),
  signature("SCREEN$", ["numeric", "numeric"], "string"), signature("VAL$", ["string"], "string"),
  ...["CODE", "VAL", "LEN"].map((name) => signature(name, ["string"], "numeric")),
  ...["SIN", "COS", "TAN", "ASN", "ACS", "ATN", "LN", "EXP", "INT", "SQR", "SGN", "ABS", "PEEK", "IN"].map((name) => signature(name, ["numeric"], "numeric")),
  signature("USR", ["numeric-or-string"], "numeric"),
  signature("STR$", ["numeric"], "string"), signature("CHR$", ["numeric"], "string")
]);
