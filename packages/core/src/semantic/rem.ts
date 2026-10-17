import { analyzeSourceText } from "./spectrum-text.js";
import type { Diagnostic } from "../source/diagnostic.js";
import type { SourceDocument } from "../source/document.js";
import type { RemStatement } from "../source/rem.js";
export interface BasicRemStatement extends RemStatement { readonly bytes: readonly number[] }
export function analyzeRemStatement(source: SourceDocument, node: RemStatement, diagnostics: Diagnostic[]): BasicRemStatement | undefined {
  const text = analyzeSourceText(source, [{ value: node.text, range: node.tailRange }], diagnostics);
  return text === undefined ? undefined : Object.freeze({ ...node, bytes: text.bytes });
}
