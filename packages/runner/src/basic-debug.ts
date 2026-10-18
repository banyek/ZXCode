import {mkdtemp,writeFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {checkProgram,writeBasicTap} from "@zxcode/core";
import type {SourceDocument} from "@zxcode/core";
import {createRunBuildMetadata} from "./identity.js";
import type {RunBuildMetadata} from "./identity.js";
import {correlateBasicDispatch,machineBytesHash,ORIGINAL_48K_ROM_SHA256} from "./basic-location.js";
import type {BasicDebugImage,BasicSourceLocation} from "./basic-location.js";
import type {DebugMachineBackend,DebugMachineSession,MachineStop,MachineResult,MachineInspection,MachineInspectionRequest,MachineFailure} from "./debug-machine.js";
export interface BasicBreakpointRequest {readonly line:number;readonly column?:number}
export interface BasicBreakpoint {readonly id:number;readonly verified:boolean;readonly line:number;readonly column?:number;readonly message:string;readonly encodedOffset?:number}
export type BasicDebugEvent={readonly kind:"running"}|{readonly kind:"invalidated"}|{readonly kind:"stopped";readonly reason:"entry"|"breakpoint"|"pause"|"unmapped";readonly location?:BasicSourceLocation;readonly message?:string}|{readonly kind:"output";readonly message:string}|{readonly kind:"terminated";readonly message:string};
const good=<T>(value:T):MachineResult<T>=>Object.freeze({kind:"success",value});
const bad=(message:string):MachineFailure=>Object.freeze({kind:"error",code:"invalid-state",message});
export class BasicDebugSession {
  readonly image:BasicDebugImage;readonly metadata:RunBuildMetadata;readonly artifactPath:string;
  readonly #machine:DebugMachineSession;readonly #directory:string;readonly #epoch:number;
  readonly #listeners=new Set<(event:BasicDebugEvent)=>void>();readonly #breakpoints=new Map<number,BasicBreakpoint>();
  #nextBreakpoint=0;#location:BasicSourceLocation | undefined;#lastStop:MachineStop;#state:"ready"|"running"|"stopped"|"closed"="ready";
  #attested=false;#entryPending=true;#stopOnEntry=true;#userPause=false;#romHash:string | undefined;#disabled:string | undefined;#falseHits=0;
  #tail:Promise<void>=Promise.resolve();#unsubscribe:()=>void;#deadline:ReturnType<typeof setTimeout> | undefined;#closing:Promise<MachineResult<void>> | undefined;
  constructor(image:BasicDebugImage,metadata:RunBuildMetadata,machine:DebugMachineSession,stop:MachineStop,directory:string,artifactPath:string) {
    this.image=image;this.metadata=metadata;this.#machine=machine;this.#lastStop=stop;this.#epoch=stop.epoch;this.#directory=directory;this.artifactPath=artifactPath;
    this.#unsubscribe=machine.subscribe(event=>{
      if(event.kind==="stopped")this.#schedule(event.stop);
      else if(event.kind==="invalidated") {this.#disabled="Machine image changed; restart debugging.";void this.close(this.#disabled);}
    });
    void machine.finished.then(exit=>{void this.close(exit.failure?.message??"Debug machine closed.");});
  }
  #isClosed():boolean {return this.#state==="closed";}
  get state():"ready"|"running"|"stopped"|"closed" {return this.#state;}
  get currentLocation():BasicSourceLocation | undefined {return this.#state==="stopped"?this.#location:undefined;}
  subscribe(listener:(event:BasicDebugEvent)=>void):()=>void {this.#listeners.add(listener);return ()=>{this.#listeners.delete(listener);};}
  #emit(event:BasicDebugEvent):void {for(const listener of this.#listeners) {try {listener(Object.freeze(event));}catch { /* UI errors cannot resume the machine. */ }}}
  #schedule(stop:MachineStop):void {
    this.#tail=this.#tail.then(()=>this.#handle(stop)).catch(error=>{if(!this.#isClosed()) {this.#location=undefined;this.#state="stopped";this.#disabled=String(error);this.#emit({kind:"stopped",reason:"unmapped",message:this.#disabled});}});
  }
  #publish(stop:MachineStop,reason:"entry"|"breakpoint"|"pause"|"unmapped",location?:BasicSourceLocation,message?:string):void {
    if(this.#isClosed())return;
    this.#lastStop=stop;this.#location=location;this.#state="stopped";this.#userPause=false;
    this.#emit({kind:"stopped",reason,...(location===undefined?{}:{location}),...(message===undefined?{}:{message})});
  }
  async #autoContinue(stop:MachineStop):Promise<void> {
    if(this.#isClosed())return;
    if(this.#userPause) {this.#publish(stop,"pause",undefined,"Paused between verified BASIC statements.");return;}
    const result=await this.#machine.resume(stop);
    if(result.kind==="error"&&!this.#isClosed()) {if(this.#userPause)this.#publish(stop,"pause");else this.#publish(stop,"unmapped",undefined,result.message);}
  }
  async #handle(stop:MachineStop):Promise<void> {
    if(this.#isClosed())return;
    if(this.#state==="stopped"&&this.#lastStop===stop)return;
    this.#lastStop=stop;
    if(stop.sessionId!==this.#machine.id||stop.epoch!==this.#epoch) {this.#disabled="Machine identity changed; restart debugging.";this.#publish(stop,"unmapped",undefined,this.#disabled);return;}
    if(this.#disabled!==undefined) {this.#publish(stop,"unmapped",undefined,this.#disabled);return;}
    const inspected=await this.#machine.inspect(stop,{registers:["PC","IY"],memory:[{address:0x5c3a,length:37},...(this.#romHash===undefined?[{address:0,length:16384}]:[])]});
    if(this.#isClosed())return;
    if(inspected.kind==="error") {if(inspected.code!=="stale-stop")this.#publish(stop,"unmapped",undefined,inspected.message);return;}
    const values=inspected.value,sys=values.memory[0]!.bytes;
    const word=(address:number):number=>sys[address-0x5c3a]!+256*sys[address-0x5c3a+1]!;
    this.#romHash??=machineBytesHash(values.memory[1]!.bytes);
    if(this.#romHash!==ORIGINAL_48K_ROM_SHA256) {this.#disabled="The active ROM is outside the supported original 48K debugger target.";this.#publish(stop,"unmapped",undefined,this.#disabled);return;}
    if(stop.pc===0x12ac&&!this.#userPause) {
      if(!this.#attested) {if(++this.#falseHits>100)this.#publish(stop,"unmapped",undefined,"The loaded BASIC image could not be identified.");else await this.#autoContinue(stop);return;}
      const report=(sys[0]!+1)&255;this.#emit({kind:"output",message:`Spectrum report ${report}; program execution ended.\n`});await this.close("Program execution ended.");return;
    }
    if(stop.pc!==0x1b3d||!(sys[1]!&128)||word(0x5c45)>9999) {
      if(this.#userPause||stop.reason!=="breakpoint")this.#publish(stop,"pause",undefined,"Paused outside a verified BASIC statement boundary.");
      else if(++this.#falseHits>100)this.#publish(stop,"unmapped",undefined,"The loaded BASIC image could not be identified.");
      else await this.#autoContinue(stop);
      return;
    }
    const base=word(0x5c53),end=word(0x5c4b);
    if(base<0x4000||end-base!==this.image.programBytes.length) {
      if(!this.#attested&&!this.#userPause&&++this.#falseHits<=100)await this.#autoContinue(stop);
      else {this.#disabled="Program memory no longer matches this debug build; restart debugging.";this.#publish(stop,"unmapped",undefined,this.#disabled);}return;
    }
    const program=await this.#machine.inspect(stop,{memory:[{address:base,length:end-base}]});
    if(this.#isClosed())return;
    if(program.kind==="error") {if(program.code!=="stale-stop")this.#publish(stop,"unmapped",undefined,program.message);return;}
    const mapped=correlateBasicDispatch(this.image,{stop,romSha256:this.#romHash,iy:values.registers.IY??-1,flags:sys[1]!,line:word(0x5c45),statement:sys[0x5c47-0x5c3a]!,programBase:base,variablesAddress:end,characterAddress:word(0x5c5d),programBytes:program.value.memory[0]!.bytes},{source:this.image.source,version:this.image.version});
    if(mapped.kind==="unmapped") {
      if(!this.#attested&&!this.#userPause&&mapped.reason==="changed-program"&&++this.#falseHits<=100) {await this.#autoContinue(stop);return;}
      this.#disabled=`Source correlation is unavailable (${mapped.reason}); restart debugging.`;this.#publish(stop,"unmapped",undefined,this.#disabled);return;
    }
    this.#attested=true;if(this.#deadline!==undefined){clearTimeout(this.#deadline);this.#deadline=undefined;}
    const first=this.#entryPending;this.#entryPending=false;
    const offset=word(0x5c5d)-base;
    if(this.#userPause)this.#publish(stop,"pause",mapped.location);
    else if([...this.#breakpoints.values()].some(item=>item.encodedOffset===offset))this.#publish(stop,"breakpoint",mapped.location);
    else if(first&&this.#stopOnEntry)this.#publish(stop,"entry",mapped.location);
    else await this.#autoContinue(stop);
  }
  setBreakpoints(requests:readonly BasicBreakpointRequest[]):readonly BasicBreakpoint[] {
    this.#breakpoints.clear();
    return Object.freeze(requests.map(request=>{
      const invalid=(message:string):BasicBreakpoint=>Object.freeze({id:++this.#nextBreakpoint,verified:false,line:request.line,...(request.column===undefined?{}:{column:request.column}),message});
      if(this.#isClosed()||this.#disabled!==undefined)return invalid("Restart debugging to bind this source.");
      if(!Number.isSafeInteger(request.line)||request.line<1||request.column!==undefined&&(!Number.isSafeInteger(request.column)||request.column<1))return invalid("Use a valid source row and column.");
      const matches=this.image.sourceMap.flatMap(line=>line.statements.flatMap((statement,index)=>{
        if(statement.encodedRange===undefined||statement.encodedRange.length===0)return [];
        const start=this.image.source.positionAt(statement.sourceRange.start),end=this.image.source.positionAt(statement.sourceRange.end);
        return start.line+1===request.line&&(request.column===undefined||request.column-1>=start.column&&(start.line!==end.line||request.column-1<end.column))?[{line,statement,index,start}]:[];
      }));
      const selected=matches[0];if(selected===undefined)return invalid("No executable BASIC statement at this source location.");
      const result=Object.freeze({id:++this.#nextBreakpoint,verified:true,line:request.line,column:selected.start.column+1,message:`BASIC ${selected.line.basicLineNumber}:${selected.index+1}`,encodedOffset:selected.statement.encodedRange!.offset});
      this.#breakpoints.set(result.id,result);return result;
    }));
  }
  begin(stopOnEntry=true):Promise<MachineResult<void>> {this.#stopOnEntry=stopOnEntry;return this.continue();}
  async continue():Promise<MachineResult<void>> {
    if(this.#isClosed()||this.#state==="running"||this.#disabled!==undefined)return bad(this.#disabled??"The debug machine is not stopped.");
    this.#location=undefined;this.#state="running";this.#userPause=false;this.#emit({kind:"running"});
    if(!this.#attested&&this.#deadline===undefined)this.#deadline=setTimeout(()=>{if(!this.#isClosed()&&!this.#attested){this.#disabled="The expected BASIC program did not reach a verified dispatch; restart debugging.";void this.pause();}},30000);
    const resumed=await this.#machine.resume(this.#lastStop);
    if(resumed.kind==="error"&&!this.#isClosed())this.#publish(this.#lastStop,"unmapped",undefined,resumed.message);
    return resumed;
  }
  async pause():Promise<MachineResult<void>> {
    if(this.#isClosed())return bad("Debug session is closed.");this.#userPause=true;
    const paused=await this.#machine.pause();if(paused.kind==="error")return paused;this.#schedule(paused.value);return good(undefined);
  }
  inspect(request:MachineInspectionRequest):Promise<MachineResult<MachineInspection>> {return this.#isClosed()||this.#state==="running"?Promise.resolve(bad("Pause the debug machine before inspection.")):this.#machine.inspect(this.#lastStop,request);}
  invalidateSource():void {this.#location=undefined;this.#emit({kind:"invalidated"});void this.close("BASIC source changed; restart debugging to rebuild it.");}
  close(message="Debugging stopped."):Promise<MachineResult<void>> {
    if(this.#closing!==undefined)return this.#closing;
    this.#state="closed";this.#location=undefined;this.#unsubscribe();if(this.#deadline!==undefined)clearTimeout(this.#deadline);
    this.#closing=(async()=>{const result=await this.#machine.close();await this.#machine.finished;await rm(this.#directory,{recursive:true,force:true});this.#emit({kind:"terminated",message});this.#listeners.clear();return result;})();return this.#closing;
  }
}
export async function startBasicDebugging(input:{readonly source:SourceDocument;readonly version:number},backend:DebugMachineBackend,signal?:AbortSignal):Promise<MachineResult<BasicDebugSession>> {
  if(!Number.isSafeInteger(input.version)||input.version<0)return Object.freeze({kind:"error",code:"invalid-request",message:"Debug source version must be a nonnegative safe integer."});
  const checked=checkProgram(input.source);
  if(checked.kind==="error")return Object.freeze({kind:"error",code:"invalid-request",message:"Resolve BASIC diagnostics before debugging."});
  const first=checked.encodedProgram.lines[0]?.basicLineNumber;
  if(first===undefined)return Object.freeze({kind:"error",code:"invalid-request",message:"Add a numbered BASIC program before debugging."});
  let directory:string | undefined,machine:DebugMachineSession | undefined;
  try {
    directory=await mkdtemp(join(tmpdir(),"zxcode-debug-"));const path=join(directory,"program.tap");
    const tap=writeBasicTap(checked.encodedProgram.programBytes,{filenameBytes:Uint8Array.from([90,88,67,79,68,69,32,32,32,32]),autostart:first,variablesOffset:checked.encodedProgram.programBytes.length});
    const metadata=createRunBuildMetadata(input.source,input.version,checked.encodedProgram,first,tap.tapBytes);
    await writeFile(path,tap.tapBytes);await writeFile(join(directory,"build.json"),JSON.stringify(metadata,null,2)+"\n");
    const opened=await backend.open({mode:"launch",requiredFeatures:["pause","resume","register-read","memory-read","breakpoints","load-tap"],...(signal===undefined?{}:{signal})});
    if(opened.kind==="error"){await rm(directory,{recursive:true,force:true});return opened;}machine=opened.value;
    if(!machine.capabilities.readableRegisters.includes("PC")||!machine.capabilities.readableRegisters.includes("IY")||machine.capabilities.maxReadBytes<Math.max(16421,checked.encodedProgram.programBytes.length)||machine.capabilities.maxBreakpoints<2)throw new Error("The machine lacks required coherent BASIC inspection capabilities.");
    const startupOptions=signal===undefined?undefined:{signal};
    const pause=await machine.pause(startupOptions);if(pause.kind==="error")throw new Error(pause.message);
    for(const address of [0x1b3d,0x12ac]) {const breakpoint=await machine.addBreakpoint(pause.value,{address},startupOptions);if(breakpoint.kind==="error")throw new Error(breakpoint.message);}
    const loaded=await machine.load(pause.value,{format:"tap",path},startupOptions);if(loaded.kind==="error")throw new Error(loaded.message);
    if(signal?.aborted)throw new Error("Debug startup cancelled.");
    const image:BasicDebugImage=Object.freeze({source:input.source,version:input.version,programBytes:Object.freeze(Array.from(checked.encodedProgram.programBytes)),sourceMap:metadata.sourceMap,buildId:metadata.buildId});
    return good(new BasicDebugSession(image,metadata,machine,loaded.value,directory,path));
  } catch(error) {await machine?.close();if(directory!==undefined)await rm(directory,{recursive:true,force:true});return Object.freeze({kind:"error",code:signal?.aborted?"cancelled":"runtime-failed",message:error instanceof Error?error.message:String(error)});}
}
