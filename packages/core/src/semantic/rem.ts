import { spectrumLiteralByte } from "../source/characters.js";
import { createDiagnostic, DiagnosticCodes } from "../source/diagnostic.js";
import type { Diagnostic } from "../source/diagnostic.js";
import type { SourceDocument } from "../source/document.js";
import type { RemStatement } from "../source/rem.js";
export interface BasicRemStatement extends RemStatement { readonly bytes: readonly number[] }
export function analyzeRemStatement(source: SourceDocument, node: RemStatement, diagnostics: Diagnostic[]): BasicRemStatement | undefined {
  const bytes: number[] = [];
  let offset = node.tailRange.start;
  let valid = true;
  for (const character of node.text) {
    const code = spectrumLiteralByte(character);
    if (code === undefined) {
      valid = false;
      diagnostics.push(createDiagnostic({ code: DiagnosticCodes.unsupportedCharacter, severity: "error", category: "compatibility", message: "Character has no direct Spectrum literal mapping.", range: source.range(offset, offset + character.length) }));
    } else bytes.push(code);
    offset += character.length;
  }
  return valid ? Object.freeze({ ...node, bytes: Object.freeze(bytes) }) : undefined;
}
