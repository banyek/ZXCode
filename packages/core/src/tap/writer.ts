import type { TapArtifact } from "./artifact.js";

export interface BasicTapMetadata {
  /** Exactly ten already encoded Spectrum bytes; no implicit padding/transliteration. */
  readonly filenameBytes: Uint8Array;
  /** Raw header word; values with bit 15 set disable autostart (e.g. 0x8000). */
  readonly autostart: number;
  /** Start of variables, measured from the beginning of program/data bytes. */
  readonly variablesOffset: number;
}

function checkInteger(value: number, max: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 0 || value > max) {
    throw new RangeError(`${name} must be an integer between 0 and ${max}.`);
  }
}

function checkPayload(payload: Uint8Array): void {
  if (!(payload instanceof Uint8Array)) throw new TypeError("TAP payload must be a Uint8Array.");
  checkInteger(payload.length, 0xffff - 2, "TAP payload length");
}

function writeWord(bytes: Uint8Array, offset: number, value: number): void {
  bytes[offset] = value & 0xff;
  bytes[offset + 1] = value >>> 8;
}

/** Serialize a TAP block, including its length prefix, flag and XOR parity. */
export function writeTapBlock(flag: number, payload: Uint8Array): Uint8Array {
  checkInteger(flag, 0xff, "TAP flag");
  checkPayload(payload);
  const block = new Uint8Array(payload.length + 4);
  writeWord(block, 0, payload.length + 2);
  block[2] = flag;
  block.set(payload, 3);
  let parity = flag;
  for (const byte of payload) parity ^= byte;
  block[block.length - 1] = parity;
  return block;
}

/** Wrap opaque program/data bytes in a type-zero BASIC header and data block. */
export function writeBasicTap(programData: Uint8Array, metadata: BasicTapMetadata): TapArtifact {
  checkPayload(programData);
  if (!(metadata.filenameBytes instanceof Uint8Array) || metadata.filenameBytes.length !== 10) {
    throw new RangeError("TAP filename must contain exactly ten encoded bytes.");
  }
  checkInteger(metadata.autostart, 0xffff, "Autostart parameter");
  checkInteger(metadata.variablesOffset, programData.length, "Variables offset");
  const header = new Uint8Array(17);
  header[0] = 0; // BASIC program, distinct from the header block's flag byte.
  header.set(metadata.filenameBytes, 1);
  writeWord(header, 11, programData.length);
  writeWord(header, 13, metadata.autostart);
  writeWord(header, 15, metadata.variablesOffset);
  const headerBlock = writeTapBlock(0x00, header);
  const dataBlock = writeTapBlock(0xff, programData);
  const tapBytes = new Uint8Array(headerBlock.length + dataBlock.length);
  tapBytes.set(headerBlock);
  tapBytes.set(dataBlock, headerBlock.length);
  return Object.freeze({ tapBytes });
}
