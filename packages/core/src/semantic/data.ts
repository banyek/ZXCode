import type { Diagnostic } from "../source/diagnostic.js";
import type { SourceDocument, SourceRange } from "../source/document.js";
import type { DataStatement, ReadStatement } from "../syntax/data.js";
import { analyzeExpressionNode } from "./expression.js";
import type { TypedExpression } from "./expression.js";
import { analyzeAssignableTarget } from "./targets.js";
import type { BasicAssignableTarget } from "./targets.js";

export interface BasicDataStatement {
  readonly kind: "data";
  readonly range: SourceRange;
  readonly items: readonly TypedExpression[];
  readonly commaRanges: readonly SourceRange[];
}
export interface BasicReadStatement {
  readonly kind: "read";
  readonly range: SourceRange;
  readonly targets: readonly BasicAssignableTarget[];
  readonly commaRanges: readonly SourceRange[];
}
export function analyzeDataStatement(source: SourceDocument, node: DataStatement, diagnostics: Diagnostic[]): BasicDataStatement | undefined {
  const items = node.items.map((item) => analyzeExpressionNode(source, item, diagnostics));
  if (!node.complete || items.length === 0 || node.commaRanges.length !== items.length - 1 || items.some((item) => item.type === "unknown" || item.type === "error")) return undefined;
  return Object.freeze({ kind: "data", range: node.range, items: Object.freeze(items), commaRanges: node.commaRanges });
}
export function analyzeReadStatement(source: SourceDocument, node: ReadStatement, diagnostics: Diagnostic[]): BasicReadStatement | undefined {
  const targets: BasicAssignableTarget[] = [];
  let valid = node.complete && node.targets.length > 0 && node.commaRanges.length === node.targets.length - 1;
  for (const target of node.targets) {
    const checked = analyzeAssignableTarget(source, target, diagnostics);
    if (checked === undefined) valid = false;
    else targets.push(checked);
  }
  return valid ? Object.freeze({ kind: "read", range: node.range, targets: Object.freeze(targets), commaRanges: node.commaRanges }) : undefined;
}
