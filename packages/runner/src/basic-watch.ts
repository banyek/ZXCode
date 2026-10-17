import {SourceDocument,parseExpression} from "@zxcode/core";
import type {BasicVariableInspection} from "./basic-inspection.js";
import {runtimeVariableNodes} from "./basic-variable-view.js";
import type {RuntimeVariableNode} from "./basic-variable-view.js";
/** Select stored values only: never execute a BASIC expression or host evaluator. */
export function selectBasicWatch(inspection:BasicVariableInspection,text:string):RuntimeVariableNode {
  if(text.length>1024)throw new Error("Watch selector is too long.");
  if(inspection.table.kind!=="decoded")throw new Error("Watch values require a complete supported variable table.");
  const source=new SourceDocument("watch",text),parsed=parseExpression(source,source.range(0,text.length)),expression=parsed.syntax;
  const unsupported=():never=>{throw new Error("Supported watches are variable names and numeric arrays with positive decimal integer indices.");};
  if(parsed.diagnostics.length!==0)return unsupported();
  const roots=runtimeVariableNodes(inspection);
  if(expression.kind==="name-expression") {
    const index=inspection.table.variables.findIndex(variable=>variable.key===expression.identity.key&&(variable.kind==="number"||variable.kind==="string"||variable.kind==="for"));
    if(index<0)throw new Error("Variable is not present in this paused snapshot.");return roots[index]!;
  }
  if(expression.kind!=="access-expression"||expression.base.kind!=="name-expression"||!expression.group.complete||!expression.group.closed||expression.base.identity.valueType!=="numeric")return unsupported();
  const name=expression.base.identity.canonicalName;
  const index=inspection.table.variables.findIndex(variable=>variable.key===`numeric-array:${name}`),variable=inspection.table.variables[index];
  if(variable?.kind!=="number-array")throw new Error("Numeric array is not present in this paused snapshot.");
  if(expression.group.selectors.length!==variable.dimensions.length)throw new Error("Array index count does not match its dimensions.");
  let flat=0;
  for(const [dimension,selector] of expression.group.selectors.entries()) {
    if(selector.kind!=="index"||selector.expression.kind!=="numeric-literal"||!/^\d+$/.test(selector.expression.lexeme))return unsupported();
    const value=Number(selector.expression.lexeme),size=variable.dimensions[dimension]!;
    if(!Number.isSafeInteger(value)||value<1||value>size)throw new Error("Array index is outside its stored bounds.");
    flat=flat*size+value-1;
  }
  return roots[index]!.children(flat,1)[0]!;
}
