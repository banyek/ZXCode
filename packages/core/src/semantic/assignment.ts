import { createDiagnostic, DiagnosticCodes } from "../source/diagnostic.js";
import type { Diagnostic } from "../source/diagnostic.js";
import type { SourceDocument, SourceRange } from "../source/document.js";
import { identifyVariable } from "../source/variable-identity.js";
import type { ScalarAssignmentTarget } from "../source/assignment-target.js";
import type { LetStatement } from "../syntax/assignment.js";
import { analyzeExpressionNode, requireExpressionType } from "./expression.js";
import type { TypedExpression } from "./expression.js";

export interface BasicLetStatement {
  readonly kind: "let";
  readonly range: SourceRange;
  readonly target: ScalarAssignmentTarget;
  readonly expression: TypedExpression;
}
export function analyzeLetStatement(source: SourceDocument, node: LetStatement, diagnostics: Diagnostic[]): BasicLetStatement | undefined {
  const expression = analyzeExpressionNode(source, node.expression, diagnostics);
  if (!node.complete || node.target.kind === "error-target") {
    if (!diagnostics.some((item) => item.severity === "error" && item.range.start >= node.range.start && item.range.end <= node.range.end)) diagnostics.push(createDiagnostic({ code: DiagnosticCodes.invalidAssignmentTarget, severity: "error", category: "syntax", message: "LET target or assignment delimiter is invalid.", range: node.range }));
    return undefined;
  }
  const name = node.target.identity.sourceName;
  const identified = identifyVariable(name, name.endsWith("$") ? "string-scalar" : "numeric-scalar");
  if (identified.kind === "error") {
    diagnostics.push(createDiagnostic({ code: DiagnosticCodes.invalidAssignmentTarget, severity: "error", category: "syntax", message: "Invalid scalar assignment target.", range: node.target.range }));
    return undefined;
  }
  if (!requireExpressionType(expression, identified.identity.valueType, diagnostics)) return undefined;
  return Object.freeze({ kind: "let", range: node.range, target: Object.freeze({ kind: "scalar-target", range: node.target.range, identity: identified.identity }), expression });
}
