import { createDiagnostic, DiagnosticCodes } from "../source/diagnostic.js";
import type { Diagnostic } from "../source/diagnostic.js";
import type { SourceDocument } from "../source/document.js";
import { simpleCommandByName } from "../source/simple-commands.js";
import type { SimpleCommandStatement } from "../source/simple-commands.js";
import type { Expression } from "../syntax/expression.js";
import { analyzeExpressionNode, requireExpressionType } from "./expression.js";
import type { ExpectedExpressionType, TypedExpression } from "./expression.js";

export function analyzeSimpleCommand(source: SourceDocument, node: SimpleCommandStatement<Expression>, diagnostics: Diagnostic[]): SimpleCommandStatement<TypedExpression> | undefined {
  const definition = simpleCommandByName(node.definition.token.spelling);
  const report = (message: string, syntax = true): void => {
    diagnostics.push(createDiagnostic({ code: syntax ? DiagnosticCodes.unexpectedToken : DiagnosticCodes.unsupportedSyntax, severity: "error", category: syntax ? "syntax" : "compatibility", message, range: node.range }));
  };
  if (definition === undefined || !node.complete) { report("Malformed or unsupported command structure."); return undefined; }
  const shape = definition.shape;
  const count = node.operands.length;
  const arity = shape === "none" ? count === 0 : shape === "optional-number" ? count <= 1
    : shape === "number-pair" || shape === "string-pair" || shape === "open" || shape === "plot" ? count === 2
      : shape === "draw" ? count === 2 || count === 3 : shape === "circle" ? count === 3 : count === 1;
  if (!arity || (node.controls.length !== 0 && !["plot", "draw", "circle"].includes(shape))) { report("Incorrect command operand/control structure."); return undefined; }
  let valid = true;
  const operands = node.operands.map((operand, index) => {
    const typed = analyzeExpressionNode(source, operand, diagnostics);
    const expected: ExpectedExpressionType = shape === "string" || shape === "string-pair" || (shape === "open" && index === 1) ? "string" : "numeric";
    if (!requireExpressionType(typed, expected, diagnostics)) valid = false;
    return typed;
  });
  const controls = node.controls.map((control) => {
    const typed = analyzeExpressionNode(source, control.expression, diagnostics);
    const definition = simpleCommandByName(control.token.spelling);
    if (definition?.shape !== "colour" || (control.separator !== ";" && control.separator !== ",")) { report("Malformed graphics colour control."); valid = false; }
    if (!requireExpressionType(typed, "numeric", diagnostics)) valid = false;
    return Object.freeze({ ...control, token: definition?.token ?? control.token, expression: typed });
  });
  if (definition.pendingCapabilityPolicy) report("Build support for this ROM command is pending runtime capability checking.", false);
  return valid ? Object.freeze({ kind: "simple-command", range: node.range, definition, operands: Object.freeze(operands), controls: Object.freeze(controls), complete: true }) : undefined;
}
