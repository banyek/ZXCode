import { createDiagnostic, DiagnosticCodes } from "../source/diagnostic.js";
import type { Diagnostic } from "../source/diagnostic.js";
import type { SourceDocument, SourceRange } from "../source/document.js";
import { analyzeAssignableTarget } from "./targets.js";
import type { BasicAssignableTarget } from "./targets.js";
import type { LetStatement } from "../syntax/assignment.js";
import { analyzeExpressionNode, requireExpressionType } from "./expression.js";
import type { TypedExpression } from "./expression.js";

export interface BasicLetStatement {
  readonly kind: "let";
  readonly range: SourceRange;
  readonly target: BasicAssignableTarget;
  readonly expression: TypedExpression;
}
export function analyzeLetStatement(source: SourceDocument, node: LetStatement, diagnostics: Diagnostic[]): BasicLetStatement | undefined {
  const target = analyzeAssignableTarget(source, node.target, diagnostics);
  const expression = analyzeExpressionNode(source, node.expression, diagnostics);
  if (!node.complete) {
    if (!diagnostics.some((item) => item.severity === "error" && item.range.start >= node.range.start && item.range.end <= node.range.end)) diagnostics.push(createDiagnostic({ code: DiagnosticCodes.invalidAssignmentTarget, severity: "error", category: "syntax", message: "LET assignment delimiter is invalid.", range: node.range }));
    return undefined;
  }
  if (target === undefined || !requireExpressionType(expression, target.identity.valueType, diagnostics)) return undefined;
  return Object.freeze({ kind: "let", range: node.range, target, expression });
}
