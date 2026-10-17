import type { Diagnostic } from "../source/diagnostic.js";
import type { SourceDocument } from "../source/document.js";
import type { CassetteForm, CassetteStatement, ListingStatement } from "../source/storage-statements.js";
import { identifyVariable } from "../source/variable-identity.js";
import type { Expression } from "../syntax/expression.js";
import { analyzeExpressionNode, requireExpressionType } from "./expression.js";
import type { TypedExpression } from "./expression.js";
import type { FunctionContext } from "./function-context.js";

export function analyzeListingStatement(source: SourceDocument, node: ListingStatement<Expression>, diagnostics: Diagnostic[], context?: FunctionContext): ListingStatement<TypedExpression> | undefined {
  let valid = node.complete && (node.separator === undefined || (node.stream !== undefined && node.startLine !== undefined));
  const convert = (value: Expression): TypedExpression => { const typed = analyzeExpressionNode(source, value, diagnostics, context); if (!requireExpressionType(typed, "numeric", diagnostics)) valid = false; return typed; };
  const stream = node.stream === undefined ? undefined : convert(node.stream);
  const startLine = node.startLine === undefined ? undefined : convert(node.startLine);
  return valid ? Object.freeze({ kind: node.kind, range: node.range, complete: true, ...(node.separator === undefined ? {} : { separator: node.separator }), ...(stream === undefined ? {} : { stream }), ...(startLine === undefined ? {} : { startLine }) }) : undefined;
}
export function analyzeCassetteStatement(source: SourceDocument, node: CassetteStatement<Expression>, diagnostics: Diagnostic[], context?: FunctionContext): CassetteStatement<TypedExpression> | undefined {
  let valid = node.complete;
  const convert = (value: Expression, type: "numeric" | "string"): TypedExpression => { const typed = analyzeExpressionNode(source, value, diagnostics, context); if (!requireExpressionType(typed, type, diagnostics)) valid = false; return typed; };
  const filename = convert(node.filename, "string");
  const input = node.form;
  let form: CassetteForm<TypedExpression>;
  if (input.kind === "program" || input.kind === "screen") form = input;
  else if (input.kind === "line") { if (node.command !== "SAVE") valid = false; form = Object.freeze({ ...input, line: convert(input.line, "numeric") }); }
  else if (input.kind === "code") {
    const start = input.start === undefined ? undefined : convert(input.start, "numeric");
    const length = input.length === undefined ? undefined : convert(input.length, "numeric");
    if ((node.command === "SAVE" && (start === undefined || length === undefined)) || (input.commaRange !== undefined && (start === undefined || length === undefined)) || (length !== undefined && (start === undefined || input.commaRange === undefined))) valid = false;
    form = Object.freeze({ kind: "code", range: input.range, ...(start === undefined ? {} : { start }), ...(length === undefined ? {} : { length }), ...(input.commaRange === undefined ? {} : { commaRange: input.commaRange }) });
  } else {
    const identity = input.identity;
    const checked = identity === undefined ? undefined : identifyVariable(identity.sourceName, identity.valueType === "string" ? "string-array" : "numeric-array");
    if (!input.closed || checked?.kind !== "success") valid = false;
    form = Object.freeze({ ...input, ...(checked?.kind === "success" ? { identity: checked.identity } : {}) });
  }
  if (node.command === "MERGE" && input.kind !== "program") valid = false;
  return valid ? Object.freeze({ ...node, filename, form }) : undefined;
}
