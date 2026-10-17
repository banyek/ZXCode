import {displayRuntimeString} from "@zxcode/core";
import type {RuntimeVariable} from "@zxcode/core";
import type {BasicVariableInspection} from "./basic-inspection.js";
export interface RuntimeVariableNode {readonly name:string;readonly display:string;readonly type:string;readonly address?:number;readonly childCount:number;children(start?:number,count?:number):readonly RuntimeVariableNode[]}
const empty:readonly RuntimeVariableNode[]=Object.freeze([]);
function node(name:string,display:string,type:string,address:number | undefined,childCount=0,children:RuntimeVariableNode["children"]=()=>empty):RuntimeVariableNode {return Object.freeze({name,display,type,...(address===undefined?{}:{address}),childCount,children});}
function arrayChildren(variable:Extract<RuntimeVariable,{kind:"number-array"|"character-array"}>,base:number,start=0,count=0):readonly RuntimeVariableNode[] {
  if(!Number.isSafeInteger(start)||start<0||!Number.isSafeInteger(count)||count<0)throw new RangeError("Variable pages use nonnegative integer bounds.");
  const size=variable.kind==="number-array"?variable.values.length:variable.bytes.length,end=count===0?size:Math.min(size,start+count),values:RuntimeVariableNode[]=[];
  for(let index=start;index<end;index++) {
    let remaining=index;const coordinates:number[]=[];
    for(const dimension of variable.dimensions.toReversed()){coordinates.unshift(remaining%dimension+1);remaining=Math.floor(remaining/dimension);}
    values.push(variable.kind==="number-array"?node(`(${coordinates.join(",")})`,String(variable.values[index]),"number",base+index*5):node(`(${coordinates.join(",")})`,displayRuntimeString([variable.bytes[index]!]),"character",base+index));
  }
  return Object.freeze(values);
}
export function runtimeVariableNodes(inspection:BasicVariableInspection):readonly RuntimeVariableNode[] {
  const base=inspection.variablesAddress;
  if(inspection.table.kind!=="decoded")return Object.freeze([node("Unsupported variable memory",inspection.table.issues.map(issue=>issue.message).join(" "),"unavailable",base)]);
  return Object.freeze(inspection.table.variables.map(variable=>{
    const address=base+variable.dataOffset;
    if(variable.kind==="number")return node(variable.name,String(variable.value),"number",address);
    if(variable.kind==="string")return node(variable.name,displayRuntimeString(variable.bytes),"string",variable.bytes.length===0?undefined:address);
    if(variable.kind==="for") {
      const children=Object.freeze([node("limit",String(variable.limit),"number",address+5),node("step",String(variable.step),"number",address+10),node("loop line",String(variable.loopLine),"continuation",address+15),node("loop statement",String(variable.loopStatement),"continuation",address+17)]);
      return node(variable.name,String(variable.value),"FOR control",address,children.length,(start=0,count=0)=>Object.freeze(children.slice(start,count===0?undefined:start+count)));
    }
    const count=variable.kind==="number-array"?variable.values.length:variable.bytes.length;
    return node(variable.name,`${variable.kind==="number-array"?"numeric":"character"} array (${variable.dimensions.join(",")})`,variable.kind,address,count,(start=0,length=0)=>arrayChildren(variable,address,start,length));
  }));
}
