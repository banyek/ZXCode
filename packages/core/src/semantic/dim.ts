import { createDiagnostic, DiagnosticCodes } from "../source/diagnostic.js";
import type { Diagnostic } from "../source/diagnostic.js";
import type { SourceDocument, SourceRange } from "../source/document.js";
import { identifyVariable } from "../source/variable-identity.js";
import type { VariableIdentity } from "../source/variable-identity.js";
import type { DimStatement } from "../syntax/dim.js";
import { analyzeExpressionNode, requireExpressionType } from "./expression.js";
import type { TypedExpression } from "./expression.js";

export interface BasicDimStatement {
  readonly kind: "dim";
  readonly range: SourceRange;
  readonly nameRange: SourceRange;
  readonly identity: VariableIdentity;
  readonly dimensions: readonly TypedExpression[];
}
export function analyzeDimStatement(source: SourceDocument, node: DimStatement, diagnostics: Diagnostic[]): BasicDimStatement | undefined {
  const fail = (message: string): undefined => {
    if (!diagnostics.some((item) => item.severity === "error" && item.range.sourceId === source.id && item.range.start >= node.range.start && item.range.end <= node.range.end)) diagnostics.push(createDiagnostic({ code: DiagnosticCodes.unexpectedToken, severity: "error", category: "syntax", message, range: node.range }));
    return undefined;
  };
  if (!node.complete || node.target.kind !== "indexed-target" || node.target.groups.length !== 1) return fail("Malformed DIM name/dimension group.");
  const group = node.target.groups[0]!;
  if (!group.complete || !group.closed || group.selectors.length === 0 || group.selectors.some((selector) => selector.kind !== "index")) return fail("DIM dimensions cannot be empty or TO slices.");
  const name = node.target.identity.sourceName;
  const identified = identifyVariable(name, name.endsWith("$") ? "string-array" : "numeric-array");
  if (identified.kind === "error") return fail("DIM array name requires one letter, optionally followed by '$'.");
  const dimensions: TypedExpression[] = [];
  let valid = true;
  for (const selector of group.selectors) {
    if (selector.kind !== "index") continue;
    const expression = analyzeExpressionNode(source, selector.expression, diagnostics);
    if (!requireExpressionType(expression, "numeric", diagnostics)) valid = false;
    dimensions.push(expression);
  }
  return valid ? Object.freeze({ kind: "dim", range: node.range, nameRange: node.target.nameRange, identity: identified.identity, dimensions: Object.freeze(dimensions) }) : undefined;
}
