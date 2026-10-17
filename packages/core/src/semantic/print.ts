import { createDiagnostic, DiagnosticCodes } from "../source/diagnostic.js";
import type { Diagnostic } from "../source/diagnostic.js";
import type { SourceDocument } from "../source/document.js";
import type { PrintItem, PrintStatement } from "../source/print-items.js";
import { simpleCommandByName } from "../source/simple-commands.js";
import type { Expression } from "../syntax/expression.js";
import { analyzeExpressionNode, requireExpressionType } from "./expression.js";
import type { ExpectedExpressionType, TypedExpression } from "./expression.js";

export function analyzePrintStatement(source: SourceDocument, node: PrintStatement<Expression>, diagnostics: Diagnostic[]): PrintStatement<TypedExpression> | undefined {
  let valid = node.complete;
  const items: PrintItem<TypedExpression>[] = [];
  const convert = (expression: Expression, expected: ExpectedExpressionType): TypedExpression => {
    const result = analyzeExpressionNode(source, expression, diagnostics);
    if (!requireExpressionType(result, expected, diagnostics)) valid = false;
    return result;
  };
  const malformed = (message: string): void => {
    valid = false;
    diagnostics.push(createDiagnostic({ code: DiagnosticCodes.unexpectedToken, severity: "error", category: "syntax", message, range: node.range }));
  };
  if (!node.complete) malformed("PRINT item boundaries are incomplete.");
  for (const item of node.items) {
    switch (item.kind) {
      case "print-empty": items.push(item); break;
      case "print-separator":
        if (![";", ",", "'"].includes(item.separator)) malformed("Invalid PRINT separator.");
        items.push(item); break;
      case "print-expression": items.push(Object.freeze({ ...item, expression: convert(item.expression, "numeric-or-string") })); break;
      case "print-at":
        if (!item.complete) malformed("AT coordinates require a comma.");
        items.push(Object.freeze({ ...item, row: convert(item.row, "numeric"), column: convert(item.column, "numeric") })); break;
      case "print-tab": items.push(Object.freeze({ ...item, column: convert(item.column, "numeric") })); break;
      case "print-control": {
        const definition = simpleCommandByName(item.token.spelling);
        const expression = convert(item.expression, "numeric");
        if (definition?.shape !== "colour") { malformed("Invalid PRINT colour control."); break; }
        items.push(Object.freeze({ ...item, token: definition.token, expression })); break;
      }
      case "print-channel": items.push(Object.freeze({ ...item, stream: convert(item.stream, "numeric") })); break;
    }
  }
  return valid ? Object.freeze({ kind: node.kind, range: node.range, items: Object.freeze(items), complete: true }) : undefined;
}
