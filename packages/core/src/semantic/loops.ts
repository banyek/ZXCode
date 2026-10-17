import { createDiagnostic, DiagnosticCodes } from "../source/diagnostic.js";
import type { Diagnostic } from "../source/diagnostic.js";
import type { SourceDocument, SourceRange } from "../source/document.js";
import { identifyVariable } from "../source/variable-identity.js";
import type { ScalarAssignmentTarget } from "../source/assignment-target.js";
import type { ForStatement, NextStatement } from "../syntax/loops.js";
import { analyzeExpressionNode, requireExpressionType } from "./expression.js";
import type { TypedExpression } from "./expression.js";

export interface BasicForStatement {
  readonly kind: "for";
  readonly range: SourceRange;
  readonly variable: ScalarAssignmentTarget;
  readonly start: TypedExpression;
  readonly limit: TypedExpression;
  readonly step?: TypedExpression;
}
export interface BasicNextStatement {
  readonly kind: "next";
  readonly range: SourceRange;
  readonly variable: ScalarAssignmentTarget;
}
export function analyzeLoop(source: SourceDocument, node: ForStatement | NextStatement, diagnostics: Diagnostic[]): BasicForStatement | BasicNextStatement | undefined {
  const report = (message: string): void => { diagnostics.push(createDiagnostic({ code: DiagnosticCodes.invalidVariableName, severity: "error", category: "syntax", message, range: node.variable.range })); };
  if (node.variable.kind !== "scalar-target") { report("Invalid FOR/NEXT control variable."); return undefined; }
  const identified = identifyVariable(node.variable.identity.sourceName, "for-control");
  if (identified.kind === "error") { report("FOR/NEXT requires a single-letter numeric variable."); return undefined; }
  const variable: ScalarAssignmentTarget = Object.freeze({ kind: "scalar-target", range: node.variable.range, identity: identified.identity });
  if (node.kind === "next") return Object.freeze({ kind: "next", range: node.range, variable });
  const start = analyzeExpressionNode(source, node.start, diagnostics);
  const limit = analyzeExpressionNode(source, node.limit, diagnostics);
  const step = node.step === undefined ? undefined : analyzeExpressionNode(source, node.step, diagnostics);
  const startValid = requireExpressionType(start, "numeric", diagnostics);
  const limitValid = requireExpressionType(limit, "numeric", diagnostics);
  const stepValid = step === undefined || requireExpressionType(step, "numeric", diagnostics);
  if (!node.complete) diagnostics.push(createDiagnostic({ code: DiagnosticCodes.unexpectedToken, severity: "error", category: "syntax", message: "FOR variable/range delimiters are incomplete.", range: node.range }));
  return node.complete && startValid && limitValid && stepValid ? Object.freeze({ kind: "for", range: node.range, variable, start, limit, ...(step === undefined ? {} : { step }) }) : undefined;
}
