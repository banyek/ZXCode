import { createDiagnostic, DiagnosticCodes } from "../source/diagnostic.js";
import type { Diagnostic } from "../source/diagnostic.js";
import type { SourceDocument, SourceRange } from "../source/document.js";
import { identifyVariable } from "../source/variable-identity.js";
import type { ScalarAssignmentTarget } from "../source/assignment-target.js";
import type { BodyToken } from "./lexer.js";
import { readExpression } from "./expression.js";
import type { Expression } from "./expression.js";

export type AssignmentTarget = ScalarAssignmentTarget
  | { readonly kind: "error-target"; readonly range: SourceRange; readonly tokens: readonly BodyToken[]; readonly unsupported: boolean };
export interface LetStatement {
  readonly kind: "let";
  readonly range: SourceRange;
  readonly target: AssignmentTarget;
  readonly expression: Expression;
  readonly complete: boolean;
}

/** Shared assignable-target entry point for LET and later INPUT/READ grammar. */
export function parseAssignableTarget(source: SourceDocument, tokens: readonly BodyToken[], range: SourceRange, diagnostics: Diagnostic[]): AssignmentTarget {
  const spelling = source.textInRange(range);
  const identified = identifyVariable(spelling, spelling.endsWith("$") ? "string-scalar" : "numeric-scalar");
  if (identified.kind === "success") return Object.freeze({ kind: "scalar-target", range, identity: identified.identity });
  const open = tokens.findIndex((token) => token.text === "(");
  const prefix = open < 0 ? "" : source.text.slice(range.start, tokens[open]!.range.start).trim();
  const arrayName = identifyVariable(prefix, prefix.endsWith("$") ? "string-array" : "numeric-array");
  const unsupported = open > 0 && arrayName.kind === "success";
  diagnostics.push(createDiagnostic({ code: unsupported ? DiagnosticCodes.unsupportedSyntax : DiagnosticCodes.invalidAssignmentTarget, severity: "error", category: unsupported ? "compatibility" : "syntax", message: unsupported ? "Array and slice assignment targets are not supported yet." : "Expected an assignable scalar variable, not an expression.", range }));
  return Object.freeze({ kind: "error-target", range, tokens: Object.freeze([...tokens]), unsupported });
}

export function parseLetStatement(source: SourceDocument, tokens: readonly BodyToken[], range: SourceRange, diagnostics: Diagnostic[]): LetStatement {
  let depth = 0;
  let equals = -1;
  for (let index = 1; index < tokens.length; index++) {
    const text = tokens[index]!.text;
    if (text === "(") depth++;
    else if (text === ")") depth--;
    else if (text === "=" && depth === 0) { equals = index; break; }
  }
  const targetTokens = tokens.slice(1, equals < 0 ? tokens.length : equals);
  const insertion = equals < 0 ? range.end : tokens[equals]!.range.start;
  const targetRange = targetTokens.length === 0 ? source.range(insertion)
    : source.range(targetTokens[0]!.range.start, targetTokens[targetTokens.length - 1]!.range.end);
  const target = parseAssignableTarget(source, targetTokens, targetRange, diagnostics);
  let complete = equals >= 0;
  if (!complete) diagnostics.push(createDiagnostic({ code: DiagnosticCodes.unexpectedToken, severity: "error", category: "syntax", message: "Expected '=' after LET target.", range: source.range(range.end) }));
  const parsed = readExpression(source, tokens, equals < 0 ? tokens.length : equals + 1, range.end, diagnostics);
  if (parsed.next < parsed.tokens.length) {
    complete = false;
    diagnostics.push(createDiagnostic({ code: DiagnosticCodes.unexpectedToken, severity: "error", category: "syntax", message: "Unexpected token after LET expression.", range: parsed.tokens[parsed.next]!.range }));
  }
  return Object.freeze({ kind: "let", range, target, expression: parsed.expression, complete });
}
