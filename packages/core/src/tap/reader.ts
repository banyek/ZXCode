import { BASIC_TAP_HEADER_LENGTH } from "./format.js";
import type { BasicTapMetadata } from "./format.js";
export interface TapReadIssue {
  readonly code: "truncated-length" | "invalid-block-length" | "truncated-block" | "checksum-mismatch" | "unsupported-layout" | "invalid-basic-header" | "unsupported-header-type" | "data-length-mismatch" | "invalid-variables-offset";
  readonly message: string;
  readonly offset: number;
  readonly length: number;
}
export interface TapReadFailure { readonly kind: "error"; readonly issues: readonly TapReadIssue[] }
export interface TapBlock {
  readonly offset: number;
  readonly encodedLength: number;
  readonly flag: number;
  readonly payload: Uint8Array;
  readonly checksum: number;
}
export interface ReadTapBlocks { readonly kind: "success"; readonly blocks: readonly TapBlock[] }
export interface ReadBasicTap extends ReadTapBlocks {
  readonly metadata: BasicTapMetadata;
  /** Complete opaque payload, including any variables after metadata.variablesOffset. */
  readonly programData: Uint8Array;
  readonly autostartEnabled: boolean;
  readonly autostartLine?: number;
}
const word = (bytes: Uint8Array, offset: number): number => bytes[offset]! | (bytes[offset + 1]! << 8);
function failure(code: TapReadIssue["code"], message: string, offset: number, length: number): TapReadFailure {
  return Object.freeze({ kind: "error", issues: Object.freeze([Object.freeze({ code, message, offset, length })]) });
}
/** Strict framing/parity, opaque flags/payloads, no resynchronization or repair. */
export function readTapBlocks(input: Uint8Array): ReadTapBlocks | TapReadFailure {
  if (!(input instanceof Uint8Array)) throw new TypeError("TAP input must be a Uint8Array.");
  // Uint8Array.from also removes Buffer.slice's shared-view semantics.
  const bytes = Uint8Array.from(input);
  const blocks: TapBlock[] = [];
  let cursor = 0;
  while (cursor < bytes.length) {
    if (bytes.length - cursor < 2) return failure("truncated-length", "Incomplete TAP length prefix.", cursor, bytes.length - cursor);
    const length = word(bytes, cursor);
    if (length < 2) return failure("invalid-block-length", "TAP block must include flag and parity bytes.", cursor, 2);
    const start = cursor + 2;
    if (length > bytes.length - start) return failure("truncated-block", "TAP block extends past the available input.", start, bytes.length - start);
    const end = start + length;
    let parity = 0;
    for (let index = start; index < end; index++) parity ^= bytes[index]!;
    if (parity !== 0) return failure("checksum-mismatch", "TAP flag/data/parity XOR does not match.", start, length);
    blocks.push(Object.freeze({ offset: cursor, encodedLength: length + 2, flag: bytes[start]!, payload: bytes.slice(start + 1, end - 1), checksum: bytes[end - 1]! }));
    cursor = end;
  }
  return Object.freeze({ kind: "success", blocks: Object.freeze(blocks) });
}
/** Single BASIC header/data pair only; other valid TAP layouts remain opaque. */
export function readBasicTap(input: Uint8Array): ReadBasicTap | TapReadFailure {
  const parsed = readTapBlocks(input);
  if (parsed.kind === "error") return parsed;
  if (parsed.blocks.length !== 2 || parsed.blocks[0]!.flag !== 0 || parsed.blocks[1]!.flag !== 255) return failure("unsupported-layout", "Expected one BASIC header/data pair.", 0, input.length);
  const header = parsed.blocks[0]!;
  const data = parsed.blocks[1]!;
  if (header.payload.length !== BASIC_TAP_HEADER_LENGTH) return failure("invalid-basic-header", "BASIC header payload must contain seventeen bytes.", header.offset + 3, header.payload.length);
  if (header.payload[0] !== 0) return failure("unsupported-header-type", "This reader supports type-zero BASIC headers.", header.offset + 3, 1);
  if (word(header.payload, 11) !== data.payload.length) return failure("data-length-mismatch", "Header data length does not match the paired payload.", header.offset + 14, 2);
  const variablesOffset = word(header.payload, 15);
  if (variablesOffset > data.payload.length) return failure("invalid-variables-offset", "Variables offset exceeds the paired payload length.", header.offset + 18, 2);
  const autostart = word(header.payload, 13);
  const autostartEnabled = (autostart & 0xc000) === 0;
  const metadata: BasicTapMetadata = Object.freeze({ filenameBytes: header.payload.slice(1, 11), autostart, variablesOffset });
  return Object.freeze({ kind: "success", blocks: parsed.blocks, metadata, programData: data.payload.slice(), autostartEnabled, ...(autostartEnabled ? { autostartLine: autostart } : {}) });
}
