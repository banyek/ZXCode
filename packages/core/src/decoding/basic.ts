import { romTokenByByte } from "../source/rom-tokens.js";
import type { RomToken } from "../source/rom-tokens.js";
import { spectrumCharacter } from "../source/characters.js";

export interface BasicDecodeIssue {
  readonly code: "truncated-line-header" | "invalid-line-length" | "truncated-line" | "missing-line-terminator" | "truncated-number" | "unterminated-string" | "raw-byte";
  readonly offset: number;
  readonly length: number;
}
interface SegmentBase { readonly offset: number; readonly bytes: Uint8Array }
export type DecodedBasicSegment = SegmentBase & (
  { readonly kind: "token"; readonly token: RomToken }
  | { readonly kind: "literal"; readonly character: string }
  | { readonly kind: "string"; readonly content: Uint8Array }
  | { readonly kind: "rem"; readonly content: Uint8Array }
  | { readonly kind: "number-storage"; readonly value: Uint8Array }
  | { readonly kind: "raw" }
);
export interface DecodedBasicLine {
  readonly number: number;
  readonly offset: number;
  readonly bytes: Uint8Array;
  readonly segments: readonly DecodedBasicSegment[];
}
export interface DecodedBasicProgram {
  readonly bytes: Uint8Array;
  readonly lines: readonly DecodedBasicLine[];
  readonly issues: readonly BasicDecodeIssue[];
}
/** Stored records, not LIST output. Never scan for a replacement record boundary. */
export function decodeBasicProgram(input: Uint8Array): DecodedBasicProgram {
  if (!(input instanceof Uint8Array)) throw new TypeError("Expected BASIC bytes");
  const bytes = Uint8Array.from(input);
  const lines: DecodedBasicLine[] = [];
  const issues: BasicDecodeIssue[] = [];
  const issue = (code: BasicDecodeIssue["code"], offset: number, length: number): void => { issues.push(Object.freeze({ code, offset, length })); };
  let cursor = 0;
  while (cursor < bytes.length) {
    const start = cursor;
    if (cursor + 4 > bytes.length) { issue("truncated-line-header", cursor, bytes.length - cursor); break; }
    const number = bytes[cursor]! * 256 + bytes[cursor + 1]!;
    const length = bytes[cursor + 2]! + 256 * bytes[cursor + 3]!;
    if (length < 1) { issue("invalid-line-length", cursor + 2, 2); break; }
    const end = cursor + 4 + length;
    if (end > bytes.length) { issue("truncated-line", cursor, bytes.length - cursor); break; }
    if (bytes[end - 1] !== 13) { issue("missing-line-terminator", end - 1, 1); break; }
    cursor += 4;
    const segments: DecodedBasicSegment[] = [];
    while (cursor < end - 1) {
      const offset = cursor;
      const byte = bytes[cursor++]!;
      if (byte === 34) {
        const content: number[] = [];
        let closed = false;
        while (cursor < end - 1) {
          const next = bytes[cursor++]!;
          if (next === 34) {
            if (bytes[cursor] === 34 && cursor < end - 1) { content.push(34); cursor++; }
            else { closed = true; break; }
          } else content.push(next);
        }
        if (!closed) issue("unterminated-string", offset, cursor - offset);
        segments.push(Object.freeze({ kind: "string", offset, bytes: bytes.slice(offset, cursor), content: Uint8Array.from(content) }));
      } else if (byte === 0xea) {
        cursor = end - 1;
        segments.push(Object.freeze({ kind: "rem", offset, bytes: bytes.slice(offset, cursor), content: bytes.slice(offset + 1, cursor) }));
      } else if (byte === 14) {
        if (cursor + 5 > end - 1) {
          issue("truncated-number", offset, end - 1 - offset);
          cursor = end - 1;
          segments.push(Object.freeze({ kind: "raw", offset, bytes: bytes.slice(offset, cursor) }));
        } else {
          cursor += 5;
          segments.push(Object.freeze({ kind: "number-storage", offset, bytes: bytes.slice(offset, cursor), value: bytes.slice(offset + 1, cursor) }));
        }
      } else {
        const token = romTokenByByte(byte);
        const character = byte === 0x5e ? "^" : spectrumCharacter(byte)!.literalCharacter;
        if (token !== undefined) segments.push(Object.freeze({ kind: "token", offset, bytes: bytes.slice(offset, cursor), token }));
        else if (character !== undefined) segments.push(Object.freeze({ kind: "literal", offset, bytes: bytes.slice(offset, cursor), character }));
        else {
          issue("raw-byte", offset, 1);
          segments.push(Object.freeze({ kind: "raw", offset, bytes: bytes.slice(offset, cursor) }));
        }
      }
    }
    lines.push(Object.freeze({ number, offset: start, bytes: bytes.slice(start, end), segments: Object.freeze(segments) }));
    cursor = end;
  }
  return Object.freeze({ bytes, lines: Object.freeze(lines), issues: Object.freeze(issues) });
}
