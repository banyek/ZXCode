import { checkedNumericStorage } from "../semantic/numeric.js";
import type { NumericLiteralValue } from "../semantic/numeric.js";

/** Emit the ROM marker and storage from a semantic value, without parsing text. */
export function encodeNumericLiteral(value: NumericLiteralValue): Uint8Array {
  return Uint8Array.of(0x0e, ...checkedNumericStorage(value));
}
