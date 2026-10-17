import type { Diagnostic } from "../source/diagnostic.js";
import type { SourceDocument, SourceRange } from "../source/document.js";
import type { DefFnStatement } from "../syntax/functions.js";
import type { VariableIdentity } from "../source/variable-identity.js";
import { analyzeExpressionNode, requireExpressionType } from "./expression.js";
import type { TypedExpression } from "./expression.js";
import type { FunctionBinding, FunctionContext } from "./function-context.js";

export interface BasicDefFnStatement {
  readonly kind: "def-fn";
  readonly range: SourceRange;
  readonly nameRange: SourceRange;
  readonly identity: VariableIdentity;
  readonly parameters: FunctionBinding["parameters"];
  readonly body: TypedExpression;
}
export function functionBinding(node: DefFnStatement): FunctionBinding | undefined {
  if (!node.complete || node.name.identity === undefined || node.parameters.some((item) => item.identity === undefined)) return undefined;
  return Object.freeze({ identity: node.name.identity, range: node.name.range, parameters: Object.freeze(node.parameters.map((item) => Object.freeze({ range: item.range, identity: Object.freeze({ ...item.identity!, key: `formal:${node.range.sourceId}:${node.range.start}:${item.identity!.canonicalName}` }) }))) });
}
export function analyzeDefFnStatement(source: SourceDocument, node: DefFnStatement, diagnostics: Diagnostic[], context: FunctionContext): BasicDefFnStatement | undefined {
  const local = functionBinding(node);
  const body = analyzeExpressionNode(source, node.body, diagnostics, { definitions: context.definitions, ...(local === undefined ? {} : { local }) });
  if (local === undefined || !requireExpressionType(body, local.identity.valueType, diagnostics)) return undefined;
  return Object.freeze({ kind: "def-fn", range: node.range, nameRange: node.name.range, identity: local.identity, parameters: local.parameters, body });
}
