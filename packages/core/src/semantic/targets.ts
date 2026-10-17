import type { FunctionContext } from "./function-context.js";
import { createDiagnostic, DiagnosticCodes } from "../source/diagnostic.js";
import type { Diagnostic } from "../source/diagnostic.js";
import type { SourceDocument } from "../source/document.js";
import type { AssignableTarget } from "../source/assignment-target.js";
import { identifyVariable } from "../source/variable-identity.js";
import type { AssignmentTarget } from "../syntax/assignment.js";
import type { Expression } from "../syntax/expression.js";
import { analyzeExpressionNode } from "./expression.js";
import type { TypedExpression } from "./expression.js";

export type BasicAssignableTarget = AssignableTarget<TypedExpression>;
export function analyzeAssignableTarget(source: SourceDocument, node: AssignmentTarget, diagnostics: Diagnostic[], context?: FunctionContext): BasicAssignableTarget | undefined {
  const report = (message: string): void => {
    if (!diagnostics.some((item) => item.severity === "error" && item.range.sourceId === source.id && item.range.start >= node.range.start && item.range.end <= node.range.end)) diagnostics.push(createDiagnostic({ code: DiagnosticCodes.invalidAssignmentTarget, severity: "error", category: "syntax", message, range: node.range }));
  };
  if (node.kind === "error-target") { report("Invalid assignable target."); return undefined; }
  const name = node.identity.sourceName;
  const identified = identifyVariable(name, name.endsWith("$") ? "string-scalar" : "numeric-scalar");
  if (identified.kind === "error") { report("Invalid variable target name."); return undefined; }
  if (node.kind === "scalar-target") return Object.freeze({ kind: "scalar-target", range: node.range, identity: identified.identity });
  let expression: Expression = Object.freeze({ kind: "name-expression", range: node.nameRange, spelling: name, identity: identified.identity });
  for (const group of node.groups) expression = Object.freeze({ kind: "access-expression", range: source.range(node.range.start, group.range.end), base: expression, group });
  const analyzed = analyzeExpressionNode(source, expression, diagnostics, context);
  if (analyzed.type === "error" || analyzed.type === "unknown") return undefined;
  const groups = [];
  let base = analyzed;
  while (base.kind === "array-access" || base.kind === "string-access") { groups.push(base.group); base = base.base; }
  if (base.kind !== "name" || groups.length !== node.groups.length || groups.length === 0) { report("Target must be a named variable or indexed string/array."); return undefined; }
  return Object.freeze({ kind: "indexed-target", range: node.range, nameRange: node.nameRange, identity: base.identity, groups: Object.freeze(groups.reverse()) });
}
