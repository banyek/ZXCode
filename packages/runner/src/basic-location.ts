import {createHash} from "node:crypto";
import type {EncodedLineMapping,SourceDocument,SourceRange,SourcePosition} from "@zxcode/core";
import type {MachineStop} from "./debug-machine.js";
export const ORIGINAL_48K_ROM_SHA256="d55daa439b673b0e3f5897f99ac37ecb45f974d1862b4dadb85dec34af99cb42";
export interface BasicDebugImage {readonly source:SourceDocument;readonly version:number;readonly programBytes:readonly number[];readonly sourceMap:readonly EncodedLineMapping[];readonly buildId:string}
export interface BasicDispatchObservation {readonly stop:MachineStop;readonly romSha256:string;readonly iy:number;readonly flags:number;readonly line:number;readonly statement:number;readonly programBase:number;readonly variablesAddress:number;readonly characterAddress:number;readonly programBytes:readonly number[]}
export interface BasicSourceLocation {readonly buildId:string;readonly stop:MachineStop;readonly basicLine:number;readonly statement:number;readonly sourceRange:SourceRange;readonly position:SourcePosition}
export type BasicLocationResult={readonly kind:"mapped";readonly location:BasicSourceLocation}|{readonly kind:"unmapped";readonly reason:"wrong-rom"|"stale-source"|"not-dispatch"|"changed-program"|"invalid-bounds"|"state-mismatch"|"unmapped-offset"};
export function correlateBasicDispatch(image:BasicDebugImage,observation:BasicDispatchObservation,current:{readonly source:SourceDocument;readonly version:number}):BasicLocationResult {
  const unmapped=(reason:Extract<BasicLocationResult,{kind:"unmapped"}>["reason"]):BasicLocationResult=>Object.freeze({kind:"unmapped",reason});
  if(observation.romSha256!==ORIGINAL_48K_ROM_SHA256)return unmapped("wrong-rom");
  if(current.source!==image.source||current.version!==image.version)return unmapped("stale-source");
  if(observation.stop.pc!==0x1b3d||observation.iy!==0x5c3a||!(observation.flags&128)||observation.line>9999)return unmapped("not-dispatch");
  const base=observation.programBase,end=observation.variablesAddress,address=observation.characterAddress,bytes=image.programBytes;
  if(![base,end,address].every(value=>Number.isSafeInteger(value)&&value>=0x4000&&value<=65535)||end-base!==bytes.length||address<base||address>=end)return unmapped("invalid-bounds");
  if(observation.programBytes.length!==bytes.length||bytes.some((byte,index)=>byte!==observation.programBytes[index]))return unmapped("changed-program");
  const offset=address-base;
  const matches=image.sourceMap.flatMap(line=>line.statements.flatMap((statement,index)=>statement.encodedRange?.offset===offset&&statement.encodedRange.length>0?[{line,statement,index}]:[]));
  if(matches.length!==1)return unmapped("unmapped-offset");
  const match=matches[0]!;
  if(match.line.basicLineNumber!==observation.line||match.index+1!==observation.statement)return unmapped("state-mismatch");
  if(match.statement.sourceRange.sourceId!==image.source.id)return unmapped("stale-source");
  const range=image.source.range(match.statement.sourceRange.start,match.statement.sourceRange.end);
  return Object.freeze({kind:"mapped",location:Object.freeze({buildId:image.buildId,stop:observation.stop,basicLine:match.line.basicLineNumber,statement:match.index+1,sourceRange:range,position:image.source.positionAt(range.start)})});
}
export const machineBytesHash=(bytes:readonly number[]):string=>createHash("sha256").update(Uint8Array.from(bytes)).digest("hex");
