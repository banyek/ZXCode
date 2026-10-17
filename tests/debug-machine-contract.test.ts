import type { DebugMachineBackend, DebugMachineSession, MachineBreakpointRequest, MachineCondition, MachineStop, MachineCapabilities } from "../packages/runner/src/index.js";
declare const backend:DebugMachineBackend;
declare const machine:DebugMachineSession;
declare const stop:MachineStop;
void backend.open({mode:"launch",requiredFeatures:["pause","memory-read"]});
void machine.inspect(stop,{registers:["PC","IY"],memory:[{address:0x5c45,length:3}]});
void machine.addBreakpoint(stop,{address:0x1b3d,conditions:[{kind:"register-equals",register:"PC",value:0x1b3d}]});
const weak:MachineCapabilities={architecture:"z80",features:["pause","resume"],readableRegisters:[],writableRegisters:[],maxReadBytes:0,maxBreakpoints:0,conditionKinds:[]};void weak;
// @ts-expect-error Source positions belong above the machine adapter.
const basic:MachineBreakpointRequest={line:100,statement:2};void basic;
// @ts-expect-error Arbitrary backend expression strings are not portable conditions.
const zrcp:MachineCondition="PC=6973 AND PEEK 23621=100";void zrcp;
// @ts-expect-error A register query cannot depend on editor/source semantics.
void machine.inspect(stop,{registers:["BASIC_LINE"]});
// @ts-expect-error Stop identity is immutable.
stop.epoch=100;
// @ts-expect-error Machine stepping does not invent BASIC next-line behavior.
void machine.step(stop,{kind:"next-basic-line"});
