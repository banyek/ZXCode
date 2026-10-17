import { createDiagnostic, DiagnosticCodes } from "../source/diagnostic.js";
import type { Diagnostic } from "../source/diagnostic.js";
import type { SourceDocument, SourceRange } from "../source/document.js";
import { identifyVariable } from "../source/variable-identity.js";
import type { AssignmentTarget } from "./assignment.js";
import type { BodyToken } from "./lexer.js";
import { readExpression } from "./expression.js";
import type { Expression } from "./expression.js";

export interface ForStatement {
  readonly kind: "for";
  readonly range: SourceRange;
  readonly variable: AssignmentTarget;
  readonly start: Expression;
  readonly limit: Expression;
  readonly step?: Expression;
  readonly complete: boolean;
}
export interface NextStatement {
  readonly kind: "next";
  readonly range: SourceRange;
  readonly variable: AssignmentTarget;
}
function variable(source: SourceDocument, tokens: readonly BodyToken[], insertion: number, diagnostics: Diagnostic[]): AssignmentTarget {
  const range = tokens.length === 0 ? source.range(insertion) : source.range(tokens[0]!.range.start, tokens[tokens.length - 1]!.range.end);
  const identified = identifyVariable(source.textInRange(range), "for-control");
  if (identified.kind === "success") return Object.freeze({ kind: "scalar-target", range, identity: identified.identity });
  diagnostics.push(createDiagnostic({ code: DiagnosticCodes.invalidVariableName, severity: "error", category: "syntax", message: "FOR/NEXT requires one single-letter numeric control variable.", range }));
  return Object.freeze({ kind: "error-target", range, tokens: Object.freeze([...tokens]), unsupported: false });
}
export function parseNextStatement(source: SourceDocument, tokens: readonly BodyToken[], range: SourceRange, diagnostics: Diagnostic[]): NextStatement {
  return Object.freeze({ kind: "next", range, variable: variable(source, tokens.slice(1), range.end, diagnostics) });
}
export function parseForStatement(source: SourceDocument, input: readonly BodyToken[], range: SourceRange, diagnostics: Diagnostic[]): ForStatement {
  let tokens = input;
  const equals = tokens.findIndex((token, index) => index > 0 && token.text === "=");
  const target = variable(source, tokens.slice(1, equals < 0 ? tokens.length : equals), equals < 0 ? range.end : tokens[equals]!.range.start, diagnostics);
  let cursor = equals < 0 ? tokens.length : equals + 1;
  let complete = true;
  const report = (message: string): void => {
    complete = false;
    diagnostics.push(createDiagnostic({ code: DiagnosticCodes.unexpectedToken, severity: "error", category: "syntax", message, range: tokens[cursor]?.range ?? source.range(range.end) }));
  };
  if (equals < 0) report("Expected '=' after FOR variable.");
  const expression = (): Expression => {
    const result = readExpression(source, tokens, cursor, range.end, diagnostics);
    tokens = result.tokens;
    cursor = result.next;
    return result.expression;
  };
  const start = expression();
  if (tokens[cursor]?.text.toUpperCase() === "TO") cursor++;
  else report("Expected TO after FOR initial value.");
  const limit = expression();
  let step: Expression | undefined;
  if (tokens[cursor]?.text.toUpperCase() === "STEP") { cursor++; step = expression(); }
  if (cursor < tokens.length) report("Unexpected token after FOR range/STEP.");
  return Object.freeze({ kind: "for", range, variable: target, start, limit, ...(step === undefined ? {} : { step }), complete });
}
