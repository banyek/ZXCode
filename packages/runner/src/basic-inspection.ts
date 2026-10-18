import {decodeBasicVariables} from "@zxcode/core";
import type {RuntimeVariableTable} from "@zxcode/core";
import {machineBytesHash,ORIGINAL_48K_ROM_SHA256} from "./basic-location.js";
import type {MachineResult,MachineInspection,MachineInspectionRequest,MachineStop,MachineFailure} from "./debug-machine.js";
export interface PausedMemoryReader {readonly romSha256:string | undefined;inspect(request:MachineInspectionRequest):Promise<MachineResult<MachineInspection>>}
export interface BasicVariableInspection {readonly stop:MachineStop;readonly variablesAddress:number;readonly editLineAddress:number;readonly table:RuntimeVariableTable}
const bad=(code:MachineFailure["code"],message:string):MachineFailure=>Object.freeze({kind:"error",code,message});
export async function inspectBasicVariables(reader:PausedMemoryReader):Promise<MachineResult<BasicVariableInspection>> {
  const cachedRom=reader.romSha256;
  const first=await reader.inspect({memory:[{address:0x5c4b,length:16},...(cachedRom===undefined?[{address:0,length:16384}]:[])]});
  if(first.kind==="error")return first;
  const hash=cachedRom??machineBytesHash(first.value.memory[1]!.bytes);
  if(hash!==ORIGINAL_48K_ROM_SHA256)return bad("unsupported-operation","Semantic variable inspection requires the original 48K ROM; raw memory remains available.");
  if(first.value.memory[0]?.bytes.length!==16)return bad("protocol-error","Invalid runtime system-variable read length.");
  const sys=first.value.memory[0]!.bytes,word=(offset:number):number=>sys[offset]!+sys[offset+1]!*256;
  const variables=word(0),program=word(8),end=word(14);
  if(![program,variables,end].every(Number.isSafeInteger)||program<0x4000||variables<program||end<=variables||end>65535)return bad("invalid-state","Runtime variable bounds are invalid; use raw memory inspection.");
  const data=await reader.inspect({memory:[{address:variables,length:end-variables}]});
  if(data.kind==="error")return data;
  if(data.value.stop!==first.value.stop)return bad("stale-stop","Machine stop changed while reading runtime variables.");
  const table=decodeBasicVariables(Uint8Array.from(data.value.memory[0]!.bytes));
  const checked=await reader.inspect({});if(checked.kind==="error")return checked;
  if(checked.value.stop!==first.value.stop)return bad("stale-stop","Runtime variable snapshot is no longer current.");
  return Object.freeze({kind:"success",value:Object.freeze({stop:first.value.stop,variablesAddress:variables,editLineAddress:end,table})});
}
export async function readPausedMemory(reader:PausedMemoryReader,address:number,length:number):Promise<MachineResult<MachineInspection>> {
  if(!Number.isSafeInteger(address)||!Number.isSafeInteger(length)||address<0||length<1||address+length>65536)return bad("invalid-request","Memory reads require a non-wrapping 16-bit address range.");
  const result=await reader.inspect({memory:[{address,length}]});if(result.kind==="error")return result;
  const current=await reader.inspect({});if(current.kind==="error")return current;
  return current.value.stop===result.value.stop?result:bad("stale-stop","Memory snapshot is no longer current.");
}
