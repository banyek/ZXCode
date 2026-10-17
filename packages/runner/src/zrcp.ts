import {randomUUID} from "node:crypto";
import {isAbsolute,extname} from "node:path";
import {access} from "node:fs/promises";
import {constants} from "node:fs";
import type {DebugMachineBackend,DebugMachineSession,MachineCapabilities,DebugMachineOpenOptions,MachineFeature,MachineStop,MachineResult,MachineFailure,MachineFailureCode,MachineEvent,MachineExit,MachinePhase,MachineOperationOptions,MachineInspectionRequest,MachineInspection,MachineMemoryRegion,MachineBreakpointRequest,MachineBreakpoint,MachineImage,Z80Register} from "./debug-machine.js";
import {MachineFault,ZrcpTransport} from "./zrcp-transport.js";
import {openZrcp,terminateZrcp} from "./zrcp-process.js";
import type {ZrcpConfiguration,OwnedZrcp} from "./zrcp-process.js";
export type {ZrcpConfiguration} from "./zrcp-process.js";
const good=<T>(value:T):MachineResult<T>=>Object.freeze({kind:"success",value});
const bad=(code:MachineFailureCode,message:string):MachineFailure=>Object.freeze({kind:"error",code,message});
const address=(value:number):boolean=>Number.isSafeInteger(value)&&value>=0&&value<=65535;
const readable:readonly Z80Register[]=Object.freeze(["PC","SP","AF","BC","DE","HL","IX","IY","AF2","BC2","DE2","HL2","I","R","IM"]);
const writable:readonly Z80Register[]=Object.freeze(["PC","SP","AF","BC","DE","HL","IX","IY","I","R"]);
function registers(reply:string):Partial<Record<Z80Register,number>> {
  const values:Partial<Record<Z80Register,number>>={};
  for(const match of reply.matchAll(/\b(PC|SP|AF|BC|DE|HL|IX|IY|I|R)('?)=([0-9a-fA-F]+)/g)) {
    const key=(match[1]!+(match[2]==="'"?"2":"")) as Z80Register;
    if(readable.includes(key))values[key]=Number.parseInt(match[3]!,16);
  }
  const im=/\bIM([012])\b/.exec(reply);if(im!==null)values.IM=Number(im[1]);
  if(!address(values.PC??-1))throw new MachineFault("protocol-error","ZRCP omitted a valid PC register.");
  return values;
}
export class ZrcpSession implements DebugMachineSession {
  readonly id=randomUUID();readonly backendId="zesarux-zrcp";
  readonly ownership:"owned" | "attached";
  readonly capabilities:MachineCapabilities;
  readonly finished:Promise<MachineExit>;
  readonly #connection:ZrcpTransport;readonly #owned:OwnedZrcp | undefined;
  readonly #listeners=new Set<(event:MachineEvent)=>void>();readonly #breakpoints=new Map<string,{slot:number;value:MachineBreakpoint}>();
  #phase:MachinePhase="paused";#epoch=0;#sequence=0;#current:MachineStop | undefined;
  #tail:Promise<void>=Promise.resolve();#timer:ReturnType<typeof setTimeout> | undefined;#pauseRequested=false;#pauseSerial=0;#closing=false;
  #finish!:(exit:MachineExit)=>void;#settled=false;#closingPromise:Promise<MachineResult<void>> | undefined;
  constructor(connection:ZrcpTransport,owned:OwnedZrcp | undefined) {
    this.#connection=connection;this.#owned=owned;this.ownership=owned===undefined?"attached":"owned";
    const features:MachineFeature[]=["pause","resume","step","register-read","memory-read"];
    if(owned!==undefined)features.push("register-write","memory-write","breakpoints","reset","load-z80","load-tap");
    this.capabilities=Object.freeze({architecture:"z80",features:Object.freeze(features),readableRegisters:readable,writableRegisters:owned===undefined?Object.freeze([]):writable,maxReadBytes:65536,maxBreakpoints:owned===undefined?0:16,conditionKinds:Object.freeze([])});
    this.finished=new Promise(resolve=>{this.#finish=resolve;});
    connection.onFailure(error=>{if(!this.#closing)this.#terminal(error.failure);});
    owned?.closed.then(()=>{if(!this.#closing)this.#terminal(bad("disconnected",`Owned ZEsarUX exited. ${owned.stderr()}`));}).catch(()=>{});
  }
  get phase():MachinePhase{return this.#phase;}
  subscribe(listener:(event:MachineEvent)=>void):()=>void {this.#listeners.add(listener);return ()=>{this.#listeners.delete(listener);};}
  #emit(event:MachineEvent):void {for(const listener of this.#listeners) {try {listener(Object.freeze(event));}catch { /* Listener errors never corrupt the owner. */ }}}
  #queue<T>(operation:()=>Promise<T>):Promise<T> {const result=this.#tail.then(operation,operation);this.#tail=result.then(()=>{},()=>{});return result;}
  #terminal(failure:MachineFailure):void {
    if(this.#settled||this.#closing)return;
    this.#phase="disconnected";this.#current=undefined;this.#settled=true;
    if(this.#timer!==undefined)clearTimeout(this.#timer);
    this.#connection.close();
    void terminateZrcp(this.#owned).then(()=>{const exit=Object.freeze({phase:"disconnected" as const,failure});this.#finish(exit);this.#emit({kind:"terminal",exit});this.#listeners.clear();},error=>{const exit=Object.freeze({phase:"failed" as const,failure:bad("runtime-failed",String(error))});this.#phase="failed";this.#finish(exit);this.#emit({kind:"terminal",exit});this.#listeners.clear();});
  }
  async #stop(reason:MachineStop["reason"],ids:readonly string[]=[],reply?:string):Promise<MachineStop> {
    const state=registers(reply??await this.#connection.command("get-registers"));
    this.#phase="paused";this.#pauseRequested=false;
    this.#current=Object.freeze({sessionId:this.id,epoch:this.#epoch,sequence:++this.#sequence,reason,pc:state.PC!,breakpointIds:Object.freeze([...ids])});
    this.#emit({kind:"stopped",stop:this.#current});return this.#current;
  }
  async initialize(signal?:AbortSignal):Promise<void> {
    if((await this.#connection.command("get-version",signal)).trim()!=="13.0")throw new MachineFault("unsupported-operation","Only the verified ZEsarUX 13.0 command dialect is supported.");
    await this.#connection.command("enter-cpu-step",signal);
    await this.#connection.command("set-memory-zone -1",signal);
    if(this.#owned!==undefined) {
      const table=await this.#connection.command("get-breakpoints 1 16",signal);
      const slots=[...table.matchAll(/^(?:Disabled|Enabled) (\d+): (.*)$/gm)];
      if(slots.length!==16||slots.some(match=>match[2]!.trim()!=="None"))throw new MachineFault("invalid-state","Owned no-config emulator has unexpected occupied breakpoint slots.");
    }
    await this.#stop("entry");
  }
  #guard(feature:MachineFeature,stop:MachineStop | undefined,options?:MachineOperationOptions,requiresStop=true):void {
    if(this.#settled||this.#closing)throw new MachineFault("disconnected","Debug machine session is terminal.");
    if(options?.signal?.aborted)throw new MachineFault("cancelled","Operation cancelled before execution.");
    if(!this.capabilities.features.includes(feature))throw new MachineFault("unsupported-operation",`Machine capability ${feature} is unavailable.`);
    if(requiresStop&&(stop===undefined||stop!==this.#current||this.#phase!=="paused"))throw new MachineFault("stale-stop","The stopped-state lease is no longer current.");
  }
  #perform<T>(feature:MachineFeature,stop:MachineStop | undefined,options:MachineOperationOptions | undefined,operation:()=>Promise<T>,requiresStop=true):Promise<MachineResult<T>> {
    return this.#queue(async()=>{
      try {this.#guard(feature,stop,options,requiresStop);return good(await operation());}
      catch(error) {
        const failure=error instanceof MachineFault?error.failure:bad("protocol-error",error instanceof Error?error.message:String(error));
        if(["protocol-error","timeout","runtime-failed"].includes(failure.code))this.#terminal(failure);
        return failure;
      }
    });
  }
  #pump():void {
    if(this.#phase!=="running"||this.#closing||this.#settled)return;
    void this.#queue(async()=>{
      if(this.#phase!=="running"||this.#closing||this.#settled)return;
      try {
        if(this.#pauseRequested) {await this.#stop("pause");return;}
        const reply=await this.#connection.command("run 10000");
        const pc=registers(reply).PC!;
        if(this.#pauseRequested) {await this.#stop("pause",[],reply);return;}
        if(/Breakpoint fired:/i.test(reply)||!reply.includes("Returning after 10000 opcodes")) {
          const ids=[...this.#breakpoints.values()].filter(item=>item.value.request.address===pc).map(item=>item.value.id);
          await this.#stop(ids.length>0?"breakpoint":"pause",ids,reply);
        }
      } catch(error) {this.#terminal(error instanceof MachineFault?error.failure:bad("protocol-error",String(error)));}
    }).then(()=>{if(this.#phase==="running"&&!this.#closing&&!this.#settled)this.#timer=setTimeout(()=>this.#pump(),0);});
  }
  pause(options?:MachineOperationOptions):Promise<MachineResult<MachineStop>> {
    if(!options?.signal?.aborted) {this.#pauseRequested=true;this.#pauseSerial++;}
    return this.#perform("pause",undefined,options,async()=>this.#phase==="paused"&&this.#current!==undefined?this.#current:await this.#stop("pause"),false);
  }
  resume(stop:MachineStop,options?:MachineOperationOptions):Promise<MachineResult<void>> {
    const pauseSerial=this.#pauseSerial;
    return this.#perform("resume",stop,options,async()=>{if(pauseSerial!==this.#pauseSerial)throw new MachineFault("invalid-state","A newer pause request superseded resume.");this.#current=undefined;this.#phase="running";this.#pauseRequested=false;this.#emit({kind:"running",sessionId:this.id,epoch:this.#epoch});this.#timer=setTimeout(()=>this.#pump(),0);});
  }
  step(stop:MachineStop,options?:MachineOperationOptions):Promise<MachineResult<MachineStop>> {return this.#perform("step",stop,options,async()=>this.#stop("step",[],await this.#connection.command("cpu-step",options?.signal)));}
  inspect(stop:MachineStop,request:MachineInspectionRequest,options?:MachineOperationOptions):Promise<MachineResult<MachineInspection>> {
    return this.#perform("pause",stop,options,async()=>{
      const names=request.registers??[],regions=request.memory??[];
      if(names.some(name=>!readable.includes(name)))throw new MachineFault("unsupported-operation","Requested register is not negotiated.");
      if(regions.some(region=>!address(region.address)||!Number.isSafeInteger(region.length)||region.length<1||region.address+region.length>65536)||regions.reduce((sum,region)=>sum+region.length,0)>this.capabilities.maxReadBytes)throw new MachineFault("invalid-request","Mapped memory request exceeds 16-bit bounds or negotiated read limit.");
      const all=names.length>0?registers(await this.#connection.command("get-registers",options?.signal)):{};
      const selected:Partial<Record<Z80Register,number>>={};
      for(const name of names) {if(all[name]===undefined)throw new MachineFault("protocol-error",`Register ${name} was absent.`);selected[name]=all[name];}
      const memory:MachineMemoryRegion[]=[];
      for(const region of regions) {
        const reply=(await this.#connection.command(`read-memory ${region.address} ${region.length}`,options?.signal)).trim();
        if(!/^[0-9a-fA-F]+$/.test(reply)||reply.length!==region.length*2)throw new MachineFault("protocol-error","ZRCP memory response has the wrong byte count or encoding.");
        memory.push(Object.freeze({address:region.address,bytes:Object.freeze(Array.from(Buffer.from(reply,"hex")))}));
      }
      this.#guard("pause",stop,options);
      return Object.freeze({stop,registers:Object.freeze(selected),memory:Object.freeze(memory)});
    });
  }
  async #invalidate(reason:"reset" | "load" | "write"):Promise<MachineStop> {this.#epoch++;this.#current=undefined;this.#emit({kind:"invalidated",sessionId:this.id,epoch:this.#epoch,reason});return this.#stop(reason);}
  writeMemory(stop:MachineStop,region:MachineMemoryRegion,options?:MachineOperationOptions):Promise<MachineResult<MachineStop>> {
    return this.#perform("memory-write",stop,options,async()=>{
      if(!address(region.address)||region.address<0x4000||region.bytes.length<1||region.address+region.bytes.length>65536||region.bytes.some(byte=>!Number.isSafeInteger(byte)||byte<0||byte>255))throw new MachineFault("invalid-request","Invalid memory write bytes or range.");
      for(let index=0;index<region.bytes.length;index+=1024) {
        const bytes=region.bytes.slice(index,index+1024);
        await this.#connection.command(`write-memory ${region.address+index} ${bytes.join(" ")}`,options?.signal);
        const verified=(await this.#connection.command(`read-memory ${region.address+index} ${bytes.length}`,options?.signal)).trim();
        if(verified.toLowerCase()!==Buffer.from(bytes).toString("hex"))throw new MachineFault("protocol-error","Memory write verification failed.");
      }
      return this.#invalidate("write");
    });
  }
  writeRegisters(stop:MachineStop,values:Readonly<Partial<Record<Z80Register,number>>>,options?:MachineOperationOptions):Promise<MachineResult<MachineStop>> {
    return this.#perform("register-write",stop,options,async()=>{
      const entries=Object.entries(values) as [Z80Register,number][];
      if(entries.length===0||entries.some(([name,value])=>!writable.includes(name)||!Number.isSafeInteger(value)||value<0||value>(name==="I"||name==="R"?255:65535)))throw new MachineFault("invalid-request","Invalid or unsupported register write.");
      for(const [name,value] of entries)await this.#connection.command(`set-register ${name}=${value}`,options?.signal);
      const verified=registers(await this.#connection.command("get-registers",options?.signal));
      if(entries.some(([name,value])=>verified[name]!==value))throw new MachineFault("protocol-error","Register write verification failed.");
      return this.#invalidate("write");
    });
  }
  addBreakpoint(stop:MachineStop,request:MachineBreakpointRequest,options?:MachineOperationOptions):Promise<MachineResult<MachineBreakpoint>> {
    return this.#perform("breakpoints",stop,options,async()=>{
      if(!address(request.address))throw new MachineFault("invalid-request","Breakpoint requires a 16-bit PC address.");
      if(request.conditions?.length)throw new MachineFault("unsupported-operation","Portable conditional predicates are not yet negotiated.");
      const used=new Set([...this.#breakpoints.values()].map(item=>item.slot));let slot=1;while(used.has(slot))slot++;
      if(slot>this.capabilities.maxBreakpoints)throw new MachineFault("invalid-request","Owned breakpoint capacity is exhausted.");
      const globalState=await this.#connection.command("get-breakpoints 1 1",options?.signal);
      if(/^Breakpoints: Off\b/m.test(globalState))await this.#connection.command("enable-breakpoints",options?.signal);
      else if(!/^Breakpoints: On\b/m.test(globalState))throw new MachineFault("protocol-error","Unknown global breakpoint state.");
      await this.#connection.command(`set-breakpoint ${slot} PC=${request.address}`,options?.signal);
      await this.#connection.command(`enable-breakpoint ${slot}`,options?.signal);
      const value=Object.freeze({id:randomUUID(),request:Object.freeze({address:request.address})});this.#breakpoints.set(value.id,{slot,value});return value;
    });
  }
  removeBreakpoint(stop:MachineStop,id:string,options?:MachineOperationOptions):Promise<MachineResult<void>> {
    return this.#perform("breakpoints",stop,options,async()=>{const item=this.#breakpoints.get(id);if(item===undefined)throw new MachineFault("invalid-request","Breakpoint is not owned by this session.");await this.#connection.command(`set-breakpoint ${item.slot}`,options?.signal);this.#breakpoints.delete(id);});
  }
  reset(stop:MachineStop,options?:MachineOperationOptions):Promise<MachineResult<MachineStop>> {return this.#perform("reset",stop,options,async()=>{await this.#connection.command("reset-cpu",options?.signal);return this.#invalidate("reset");});}
  load(stop:MachineStop,image:MachineImage,options?:MachineOperationOptions):Promise<MachineResult<MachineStop>> {
    return this.#perform(image.format==="z80"?"load-z80":"load-tap",stop,options,async()=>{
      if(!isAbsolute(image.path)||/[\r\n\0]/.test(image.path)||extname(image.path).toLowerCase()!=="."+image.format)throw new MachineFault("invalid-request","Image load requires an absolute matching .z80/.tap path without control characters.");
      try {await access(image.path,constants.R_OK);}catch {throw new MachineFault("invalid-request","Machine image file is not readable.");}
      await this.#connection.command(`${image.format==="tap"?"smartload":"snapshot-load"} ${image.path}`,options?.signal);return this.#invalidate("load");
    });
  }
  close():Promise<MachineResult<void>> {
    if(this.#closingPromise!==undefined)return this.#closingPromise;
    if(this.#settled) {this.#closingPromise=this.finished.then(()=>good(undefined));return this.#closingPromise;}
    this.#closing=true;this.#pauseRequested=true;if(this.#timer!==undefined)clearTimeout(this.#timer);
    this.#closingPromise=this.#queue(async()=>{
      try {
        if(!this.#settled) {
          if(this.#owned!==undefined)this.#connection.notify("exit-emulator");
          else if(this.#phase==="running")await this.#connection.command("exit-cpu-step");
        }
        await terminateZrcp(this.#owned);this.#connection.close();this.#phase="closed";this.#current=undefined;
        if(!this.#settled) {this.#settled=true;const exit=Object.freeze({phase:"closed" as const});this.#finish(exit);this.#emit({kind:"terminal",exit});this.#listeners.clear();}
        return good(undefined);
      } catch(error) {this.#connection.close();const failure=error instanceof MachineFault?error.failure:bad("runtime-failed",String(error));if(!this.#settled){this.#settled=true;this.#phase="failed";const exit=Object.freeze({phase:"failed" as const,failure});this.#finish(exit);this.#emit({kind:"terminal",exit});}return failure;}
    });return this.#closingPromise;
  }
}
export function createZrcpBackend(configuration:ZrcpConfiguration):DebugMachineBackend {
  const configured=Object.freeze({...configuration});
  return Object.freeze({id:"zesarux-zrcp",async open(options:DebugMachineOpenOptions) {
    let transport:ZrcpTransport | undefined,owned:OwnedZrcp | undefined,session:ZrcpSession | undefined;
    try {
      if(options.mode!=="launch"&&options.mode!=="attach")throw new MachineFault("invalid-request","Choose explicit launch or attach mode.");
      const opened=await openZrcp(configured,options.mode,options.signal);transport=opened.transport;owned=opened.owned;
      session=new ZrcpSession(transport,owned);
      if(options.requiredFeatures?.some(feature=>!session!.capabilities.features.includes(feature)))throw new MachineFault("unsupported-operation","Required machine features are not available in this ownership mode.");
      await session.initialize(options.signal);
      if(options.signal?.aborted)throw new MachineFault("cancelled","Debug startup cancelled.");
      return good(Object.freeze(session));
    } catch(error) {
      if(session!==undefined)await session.close();else {transport?.close();await terminateZrcp(owned);}
      return error instanceof MachineFault?error.failure:bad("runtime-failed",error instanceof Error?error.message:String(error));
    }
  }});
}
