import { spectrumCharacter, spectrumLiteralByte } from "../source/characters.js";
import { spectrumGraphicNotation } from "../source/graphics-notation.js";
import type { SourceTextContext, SpectrumTextAtom, SpectrumTextIssue } from "../source/spectrum-text.js";
import { analyzeSpectrumText, spectrumStringIssues } from "../semantic/spectrum-text.js";
export type FormattedSpectrumText = { readonly kind: "success"; readonly text: string }
  | { readonly kind: "error"; readonly issues: readonly SpectrumTextIssue[] };
/** Escaped content only: callers add outer string quotes or the REM keyword. */
export function formatSpectrumTextContent(atoms: readonly SpectrumTextAtom[], context: SourceTextContext): FormattedSpectrumText {
  const analyzed = analyzeSpectrumText(atoms);
  if (analyzed.kind === "error") return analyzed;
  const issues = context === "string" ? spectrumStringIssues(analyzed.value) : [];
  if (issues.length !== 0) return Object.freeze({ kind: "error", issues });
  const raw = (byte: number): string => `{BYTE 0x${byte.toString(16).padStart(2, "0").toUpperCase()}}`;
  const literal = (character: string): string => character === "{" ? "{{" : character === "}" ? "}}" : character === '"' && context === "string" ? '""' : character;
  const byteText = (byte: number): string => {
    const graphic = spectrumGraphicNotation(byte);
    if (graphic !== undefined) return graphic.canonicalText;
    const character = spectrumCharacter(byte)!.literalCharacter;
    return character === undefined ? raw(byte) : literal(character);
  };
  let text = "";
  for (const atom of analyzed.value.atoms) {
    if (atom.kind === "text") for (const character of atom.value) text += byteText(spectrumLiteralByte(character)!);
    else if (atom.kind === "byte") text += byteText(atom.value);
    else {
      const argument = atom.name === "TAB" ? String(atom.parameters[0]! + 256 * atom.parameters[1]!) : atom.parameters.join(",");
      text += `{${atom.name}${atom.parameters.length === 0 ? "" : ` ${argument}`}}`;
    }
  }
  if (context === "rem" && /^[A-Za-z0-9$]/.test(text)) text = raw(text.charCodeAt(0)) + text.slice(1);
  return Object.freeze({ kind: "success", text });
}
