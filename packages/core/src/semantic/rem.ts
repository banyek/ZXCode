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
    const code = character.codePointAt(0)!;
    if (code < 32 || code > 126 || code === 96) {
      valid = false;
      diagnostics.push(createDiagnostic({ code: DiagnosticCodes.unsupportedCharacter, severity: "error", category: "compatibility", message: "Character is outside the current Spectrum literal character coverage.", range: source.range(offset, offset + character.length) }));
    } else bytes.push(code);
    offset += character.length;
  }
  return valid ? Object.freeze({ ...node, bytes: Object.freeze(bytes) }) : undefined;
}
