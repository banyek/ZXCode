import { createDiagnostic, DiagnosticCodes } from "../source/diagnostic.js";
import type { Diagnostic } from "../source/diagnostic.js";
import type { SourceDocument, SourceRange } from "../source/document.js";
import { identifyVariable } from "../source/variable-identity.js";
import type { VariableIdentity } from "../source/variable-identity.js";
import type { BodyToken } from "./lexer.js";

export interface FunctionName { readonly range: SourceRange; readonly identity?: VariableIdentity }
export function readFunctionName(source: SourceDocument, tokens: readonly BodyToken[], start: number, end: number, category: "function" | "formal", diagnostics: Diagnostic[]): { readonly name: FunctionName; readonly next: number } {
  let next = start;
  while (next < tokens.length && !["(", ")", ",", "="].includes(tokens[next]!.text)) next++;
  const range = source.range(tokens[start]?.range.start ?? end, next > start ? tokens[next - 1]!.range.end : tokens[start]?.range.start ?? end);
  const result = identifyVariable(source.textInRange(range), category);
  if (result.kind === "error") diagnostics.push(createDiagnostic({ code: DiagnosticCodes.invalidVariableName, severity: "error", category: "syntax", message: "Function and formal names require one letter, optionally followed by '$'.", range }));
  return Object.freeze({ name: Object.freeze({ range, ...(result.kind === "success" ? { identity: result.identity } : {}) }), next });
}
