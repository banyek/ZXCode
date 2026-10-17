/** TAP's 16-bit stored length includes flag and parity, excluding its own prefix. */
export const MAX_TAP_PAYLOAD_LENGTH = 0xffff - 2;
export const BASIC_TAP_HEADER_LENGTH = 17;
export interface BasicTapMetadata {
  /** Exactly ten already encoded Spectrum bytes; no implicit padding/transliteration. */
  readonly filenameBytes: Uint8Array;
  /** Raw header word; either bit 14 or 15 disables autostart (default 0x8000). */
  readonly autostart: number;
  /** Start of variables within the opaque program/data payload. */
  readonly variablesOffset: number;
}
