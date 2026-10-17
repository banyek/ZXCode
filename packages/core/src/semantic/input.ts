import { createDiagnostic, DiagnosticCodes } from "../source/diagnostic.js";
import type { Diagnostic } from "../source/diagnostic.js";
import type { SourceDocument, SourceRange } from "../source/document.js";
import { identifyVariable } from "../source/variable-identity.js";
import type { ScalarAssignmentTarget } from "../source/assignment-target.js";
import type { InputItem as SourceInputItem, InputStatement as SourceInputStatement } from "../source/input-items.js";
import type { InputStatement } from "../syntax/input.js";
import type { TypedExpression } from "./expression.js";
import { analyzePrintStatement } from "./print.js";

export type BasicInputItem = SourceInputItem<TypedExpression, ScalarAssignmentTarget>;
export type BasicInputStatement = SourceInputStatement<TypedExpression, ScalarAssignmentTarget>;
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
      if (item.target.kind === "error-target") {
        report(item.target.range, "Invalid or unsupported INPUT target.", item.target.unsupported ? DiagnosticCodes.unsupportedSyntax : DiagnosticCodes.invalidAssignmentTarget, item.target.unsupported ? "compatibility" : "syntax");
        continue;
      }
      const name = item.target.identity.sourceName;
      const identified = identifyVariable(name, name.endsWith("$") ? "string-scalar" : "numeric-scalar");
      if (identified.kind === "error") { report(item.target.range, "Invalid INPUT scalar target.", DiagnosticCodes.invalidAssignmentTarget); continue; }
      if (item.lineMode && identified.identity.valueType !== "string") { report(item.target.range, "INPUT LINE requires a string variable.", DiagnosticCodes.typeMismatch, "semantic"); continue; }
      const target: ScalarAssignmentTarget = Object.freeze({ kind: "scalar-target", range: item.target.range, identity: identified.identity });
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
