import { SPECTRUM_CHARACTERS } from "./characters.js";
import type { SpectrumExportIdentity } from "./characters.js";
export type SpectrumGraphicIdentity = Extract<SpectrumExportIdentity, { readonly kind: "block" | "udg" }>;
export interface SpectrumGraphicNotation {
  readonly byte: number;
  readonly identity: SpectrumGraphicIdentity;
  readonly canonicalText: string;
}
const notations: SpectrumGraphicNotation[] = [];
for (const entry of SPECTRUM_CHARACTERS) {
  const identity = entry.exportIdentity;
  if (identity.kind === "block" || identity.kind === "udg") notations.push(Object.freeze({ byte: entry.byte, identity, canonicalText: identity.kind === "block" ? `{BLOCK ${identity.mask}}` : `{UDG ${identity.letter}}` }));
}
/** Shared components for source escape activation/export; no Unicode glyph aliases. */
export const SPECTRUM_GRAPHIC_NOTATIONS: readonly SpectrumGraphicNotation[] = Object.freeze(notations);
const byByte = new Map(SPECTRUM_GRAPHIC_NOTATIONS.map((notation) => [notation.byte, notation]));
const byText = new Map(SPECTRUM_GRAPHIC_NOTATIONS.map((notation) => [notation.canonicalText, notation]));
export function spectrumGraphicNotation(byte: number): SpectrumGraphicNotation | undefined { return byByte.get(byte); }
export function parseSpectrumGraphicNotation(text: string): SpectrumGraphicNotation | undefined {
  const folded = text.replace(/[a-z]/g, (letter) => letter.toUpperCase());
  const match = /^\{[ \t]*(?:UDG[ \t]+([A-U])|BLOCK[ \t]+(0|[1-9][0-9]*))[ \t]*\}$/.exec(folded);
  if (match === null || match[0] !== folded) return undefined;
  return byText.get(match[1] === undefined ? `{BLOCK ${match[2]}}` : `{UDG ${match[1]}}`);
}
