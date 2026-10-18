/** Portable machine facts only: no BASIC model, editor protocol or ZRCP text. */
export type MachineFeature = "pause" | "resume" | "step" | "register-read" | "register-write" | "memory-read" | "memory-write" | "breakpoints" | "reset" | "load-tap" | "load-z80";
export type Z80Register = "PC" | "SP" | "AF" | "BC" | "DE" | "HL" | "IX" | "IY" | "AF2" | "BC2" | "DE2" | "HL2" | "I" | "R" | "IM" | "IFF1" | "IFF2";
export type MachinePhase = "running" | "paused" | "disconnected" | "closed" | "failed";
export type MachineFailureCode = "unsupported-operation" | "invalid-request" | "invalid-state" | "stale-stop" | "disconnected" | "protocol-error" | "timeout" | "cancelled" | "runtime-failed";
export interface MachineFailure {readonly kind:"error";readonly code:MachineFailureCode;readonly message:string}
export type MachineResult<T> = {readonly kind:"success";readonly value:T} | MachineFailure;
export interface MachineOperationOptions {readonly signal?:AbortSignal}
export interface MachineCapabilities {
  readonly architecture:"z80";
  readonly features:readonly MachineFeature[];
  readonly readableRegisters:readonly Z80Register[];
  readonly writableRegisters:readonly Z80Register[];
  readonly maxReadBytes:number;
  readonly maxBreakpoints:number;
  readonly conditionKinds:readonly MachineCondition["kind"][];
}
export interface MachineStop {
  readonly sessionId:string;
  readonly epoch:number;
  readonly sequence:number;
  readonly reason:"entry" | "pause" | "breakpoint" | "step" | "reset" | "load" | "write";
  readonly pc:number;
  readonly breakpointIds:readonly string[];
}
export interface MachineMemoryRequest {readonly address:number;readonly length:number}
export interface MachineMemoryRegion {readonly address:number;readonly bytes:readonly number[]}
export interface MachineInspectionRequest {readonly registers?:readonly Z80Register[];readonly memory?:readonly MachineMemoryRequest[]}
export interface MachineInspection {readonly stop:MachineStop;readonly registers:Readonly<Partial<Record<Z80Register,number>>>;readonly memory:readonly MachineMemoryRegion[]}
export type MachineCondition = {readonly kind:"register-equals";readonly register:Z80Register;readonly value:number} | {readonly kind:"memory-equals";readonly address:number;readonly bytes:readonly number[]};
export interface MachineBreakpointRequest {readonly address:number;readonly conditions?:readonly MachineCondition[]}
export interface MachineBreakpoint {readonly id:string;readonly request:MachineBreakpointRequest}
/** Absolute host path; loading invalidates prior machine-image attestation. */
export interface MachineImage {readonly format:"tap" | "z80";readonly path:string}
export interface MachineExit {readonly phase:"disconnected" | "closed" | "failed";readonly failure?:MachineFailure}
export type MachineEvent = {readonly kind:"stopped";readonly stop:MachineStop} | {readonly kind:"running";readonly sessionId:string;readonly epoch:number} | {readonly kind:"invalidated";readonly sessionId:string;readonly epoch:number;readonly reason:"reset" | "load" | "write"} | {readonly kind:"terminal";readonly exit:MachineExit};
export interface DebugMachineSession {
  readonly id:string;
  readonly backendId:string;
  readonly ownership:"owned" | "attached";
  readonly phase:MachinePhase;
  readonly capabilities:MachineCapabilities;
  readonly finished:Promise<MachineExit>;
  subscribe(listener:(event:MachineEvent)=>void):()=>void;
  pause(options?:MachineOperationOptions):Promise<MachineResult<MachineStop>>;
  resume(stop:MachineStop,options?:MachineOperationOptions):Promise<MachineResult<void>>;
  step(stop:MachineStop,options?:MachineOperationOptions):Promise<MachineResult<MachineStop>>;
  inspect(stop:MachineStop,request:MachineInspectionRequest,options?:MachineOperationOptions):Promise<MachineResult<MachineInspection>>;
  writeMemory(stop:MachineStop,region:MachineMemoryRegion,options?:MachineOperationOptions):Promise<MachineResult<MachineStop>>;
  writeRegisters(stop:MachineStop,registers:Readonly<Partial<Record<Z80Register,number>>>,options?:MachineOperationOptions):Promise<MachineResult<MachineStop>>;
  addBreakpoint(stop:MachineStop,request:MachineBreakpointRequest,options?:MachineOperationOptions):Promise<MachineResult<MachineBreakpoint>>;
  removeBreakpoint(stop:MachineStop,id:string,options?:MachineOperationOptions):Promise<MachineResult<void>>;
  reset(stop:MachineStop,options?:MachineOperationOptions):Promise<MachineResult<MachineStop>>;
  load(stop:MachineStop,image:MachineImage,options?:MachineOperationOptions):Promise<MachineResult<MachineStop>>;
  close():Promise<MachineResult<void>>;
}
export interface DebugMachineOpenOptions extends MachineOperationOptions {readonly mode:"launch" | "attach";readonly requiredFeatures?:readonly MachineFeature[]}
export interface DebugMachineBackend {readonly id:string;open(options:DebugMachineOpenOptions):Promise<MachineResult<DebugMachineSession>>}
