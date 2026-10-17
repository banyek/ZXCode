import { createDiagnostic, DiagnosticCodes } from "../source/diagnostic.js";
import type { Diagnostic } from "../source/diagnostic.js";
import type { SourceDocument, SourceRange } from "../source/document.js";
import { analyzeAssignableTarget } from "./targets.js";
import type { BasicAssignableTarget } from "./targets.js";
import type { InputItem as SourceInputItem, InputStatement as SourceInputStatement } from "../source/input-items.js";
import type { InputStatement } from "../syntax/input.js";
import type { TypedExpression } from "./expression.js";
import { analyzePrintStatement } from "./print.js";

export type BasicInputItem = SourceInputItem<TypedExpression, BasicAssignableTarget>;
export type BasicInputStatement = SourceInputStatement<TypedExpression, BasicAssignableTarget>;
export function analyzeInputStatement(source: SourceDocument, node: InputStatement, diagnostics: Diagnostic[]): BasicInputStatement | undefined {
  let valid = node.complete;
  const items: BasicInputItem[] = [];
  const report = (range: SourceRange, message: string, code: string = DiagnosticCodes.unexpectedToken, category: Diagnostic["category"] = "syntax"): void => {
    valid = false;
    if (!diagnostics.some((item) => item.severity === "error" && item.range.sourceId === source.id && item.range.start >= range.start && item.range.end <= range.end)) diagnostics.push(createDiagnostic({ code, severity: "error", category, message, range }));
  };
  if (!node.complete) report(node.range, "INPUT item boundaries are incomplete.");
  for (const item of node.items) {
    if (item.kind === "input-empty" || item.kind === "input-separator") {
      if (item.kind === "input-separator" && ![";", ",", "'"].includes(item.separator)) report(item.range, "Invalid INPUT separator.");
      items.push(item);
    } else if (item.kind === "input-target") {
      const target = analyzeAssignableTarget(source, item.target, diagnostics);
      if (target === undefined) { valid = false; continue; }
      if (item.lineMode && target.identity.valueType !== "string") { report(target.range, "INPUT LINE requires a string variable.", DiagnosticCodes.typeMismatch, "semantic"); continue; }
      items.push(Object.freeze({ ...item, target }));
    } else if (item.kind === "input-display") {
      const printed = analyzePrintStatement(source, { kind: "print", range: item.range, items: [item.item], complete: true }, diagnostics);
      const converted = printed?.items[0];
      if (converted === undefined || converted.kind === "print-empty" || converted.kind === "print-separator") { valid = false; continue; }
      items.push(Object.freeze({ ...item, item: converted }));
    } else {
      if (!item.complete) report(item.range, "INPUT display group is incomplete.");
      const printed = analyzePrintStatement(source, { kind: "print", range: item.range, items: item.items, complete: true }, diagnostics);
      if (printed === undefined) { valid = false; continue; }
      items.push(Object.freeze({ ...item, items: printed.items, complete: true }));
    }
  }
  return valid ? Object.freeze({ kind: "input", range: node.range, items: Object.freeze(items), complete: true }) : undefined;
}
