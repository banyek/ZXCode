import { romTokenByByte } from "./rom-tokens.js";
import type { RomToken } from "./rom-tokens.js";

export type SpectrumCharacterCategory = "reserved" | "control" | "printable" | "spectrum-glyph" | "block-graphic" | "udg" | "token";
export type SpectrumExportIdentity =
  | { readonly kind: "character"; readonly text: string }
  | { readonly kind: "control"; readonly name: string }
  | { readonly kind: "numeric-marker" }
  | { readonly kind: "block"; readonly mask: number }
  | { readonly kind: "udg"; readonly letter: string }
  | { readonly kind: "token"; readonly spelling: string }
  | { readonly kind: "raw-byte"; readonly byte: number };
export interface SpectrumCharacter {
  readonly byte: number;
  readonly id: string;
  readonly category: SpectrumCharacterCategory;
  readonly displayText: string;
  readonly exportIdentity: SpectrumExportIdentity;
  readonly literalCharacter?: string;
  readonly sourceAliases?: readonly string[];
  readonly parameterCount?: 1 | 2;
  readonly basicPayloadLength?: 5;
  readonly token?: RomToken;
}
const controls: ReadonlyMap<number, string> = new Map([
  [6, "COMMA"], [7, "EDIT"], [8, "LEFT"], [9, "RIGHT"], [10, "DOWN"], [11, "UP"], [12, "DELETE"], [13, "ENTER"], [14, "NUMBER"],
  [16, "INK"], [17, "PAPER"], [18, "FLASH"], [19, "BRIGHT"], [20, "INVERSE"], [21, "OVER"], [22, "AT"], [23, "TAB"]
]);
// Display hints only: mask bits identify upper-right, upper-left, lower-right,
// lower-left quadrants. They never determine a source byte through glyph shape.
const blocks = [" ", "▝", "▘", "▀", "▗", "▐", "▚", "▜", "▖", "▞", "▌", "▛", "▄", "▟", "▙", "█"];
function character(byte: number): SpectrumCharacter {
  const id = `byte-${byte.toString(16).padStart(2, "0")}`;
  const record = (value: Omit<SpectrumCharacter, "byte" | "id">): SpectrumCharacter => Object.freeze({ byte, id, ...value, exportIdentity: Object.freeze(value.exportIdentity) });
  if (byte < 32) {
    const name = controls.get(byte);
    if (name === undefined) return record({ category: "reserved", displayText: `<BYTE ${id.slice(5).toUpperCase()}>`, exportIdentity: { kind: "raw-byte", byte } });
    return record({ category: "control", displayText: `<${name}>`, exportIdentity: byte === 14 ? { kind: "numeric-marker" } : { kind: "control", name }, ...(byte === 14 ? { basicPayloadLength: 5 as const } : {}), ...(byte >= 16 ? { parameterCount: byte <= 21 ? 1 as const : 2 as const } : {}) });
  }
  if (byte < 128) {
    const special = byte === 94 || byte === 96 || byte === 127;
    const text = byte === 94 ? "↑" : byte === 96 ? "£" : byte === 127 ? "©" : String.fromCharCode(byte);
    return record({ category: special ? "spectrum-glyph" : "printable", displayText: text, literalCharacter: text, exportIdentity: { kind: "character", text }, ...(byte === 94 ? { sourceAliases: Object.freeze(["^"]) } : {}) });
  }
  if (byte < 144) return record({ category: "block-graphic", displayText: blocks[byte - 128]!, exportIdentity: { kind: "block", mask: byte - 128 } });
  if (byte < 165) {
    const letter = String.fromCharCode(65 + byte - 144);
    return record({ category: "udg", displayText: `<UDG ${letter}>`, exportIdentity: { kind: "udg", letter } });
  }
  const token = romTokenByByte(byte)!;
  return record({ category: "token", displayText: token.spelling, token, exportIdentity: { kind: "token", spelling: token.spelling } });
}
/** Total original 48K byte identities, independent of text escape syntax. */
export const SPECTRUM_CHARACTERS: readonly SpectrumCharacter[] = Object.freeze(Array.from({ length: 256 }, (_, byte) => character(byte)));
export function spectrumCharacter(byte: number): SpectrumCharacter | undefined {
  return Number.isInteger(byte) && byte >= 0 && byte <= 255 ? SPECTRUM_CHARACTERS[byte] : undefined;
}
const literalBytes = new Map<string, number>();
for (const entry of SPECTRUM_CHARACTERS) {
  if (entry.literalCharacter !== undefined) literalBytes.set(entry.literalCharacter, entry.byte);
  for (const alias of entry.sourceAliases ?? []) literalBytes.set(alias, entry.byte);
}
/** Exact one-character literal mapping only; never tokenizes words or escapes. */
export function spectrumLiteralByte(character: string): number | undefined { return literalBytes.get(character); }
