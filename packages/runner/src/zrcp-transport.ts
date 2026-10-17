import {createConnection} from "node:net";
import type {Socket} from "node:net";
import type {MachineFailure,MachineFailureCode} from "./debug-machine.js";
export class MachineFault extends Error {
  readonly failure:MachineFailure;
  constructor(code:MachineFailureCode,message:string) {super(message);this.failure=Object.freeze({kind:"error",code,message});}
}
interface Pending {resolve:(reply:string)=>void;reject:(error:MachineFault)=>void;cleanup:()=>void}
/** One outstanding prompt-framed request. The machine owner serializes callers. */
export class ZrcpTransport {
  readonly #socket:Socket;
  readonly #prompt:RegExp;
  readonly #timeout:number;
  #buffer="";
  #pending:Pending | undefined;
  #failure:MachineFault | undefined;
  #onFailure:((error:MachineFault)=>void) | undefined;
  private constructor(port:number,prompt:string,timeout:number) {
    this.#timeout=timeout;
    this.#prompt=new RegExp(`\\n${prompt.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}(?:@cpu-step)?> $`);
    this.#socket=createConnection({host:"127.0.0.1",port});
    this.#socket.setNoDelay(true);
    this.#socket.on("data",data=>{
      this.#buffer+=data.toString("utf8");
      if(Buffer.byteLength(this.#buffer)>1048576) {this.#fail(new MachineFault("protocol-error","ZRCP response exceeded the 1 MiB limit."));return;}
      const match=this.#prompt.exec(this.#buffer);
      if(match===null)return;
      const pending=this.#pending;
      if(pending===undefined) {this.#fail(new MachineFault("protocol-error","Unexpected ZRCP response without an outstanding request."));return;}
      const reply=this.#buffer.slice(0,match.index);
      this.#buffer="";this.#pending=undefined;pending.cleanup();pending.resolve(reply);
    });
    this.#socket.on("error",error=>this.#fail(new MachineFault("disconnected",`ZRCP socket failed: ${error.message}`)));
    this.#socket.on("close",()=>this.#fail(new MachineFault("disconnected","ZRCP connection closed.")));
  }
  static async connect(port:number,prompt:string,timeout:number,signal?:AbortSignal):Promise<ZrcpTransport> {
    const transport=new ZrcpTransport(port,prompt,timeout);
    try {await transport.#wait(signal,Math.min(timeout,500));return transport;}catch(error){transport.close();throw error;}
  }
  onFailure(listener:(error:MachineFault)=>void):void {this.#onFailure=listener;if(this.#failure!==undefined)listener(this.#failure);}
  #fail(error:MachineFault):void {
    if(this.#failure!==undefined)return;
    this.#failure=error;
    const pending=this.#pending;this.#pending=undefined;
    pending?.cleanup();pending?.reject(error);this.#socket.destroy();this.#onFailure?.(error);
  }
  #wait(signal?:AbortSignal,deadline=this.#timeout):Promise<string> {
    if(this.#failure!==undefined)return Promise.reject(this.#failure);
    if(this.#pending!==undefined) {const fault=new MachineFault("protocol-error","Concurrent ZRCP requests are not allowed.");this.#fail(fault);return Promise.reject(fault);}
    if(signal?.aborted) {const fault=new MachineFault("cancelled","ZRCP operation cancelled.");this.#fail(fault);return Promise.reject(fault);}
    return new Promise((resolve,reject)=>{
      const aborted=():void=>this.#fail(new MachineFault("cancelled","ZRCP operation cancelled; coherent state invalidated."));
      const timer=setTimeout(()=>this.#fail(new MachineFault("timeout","ZRCP prompt deadline exceeded; coherent state invalidated.")),deadline);
      this.#pending={resolve,reject,cleanup:()=>{clearTimeout(timer);signal?.removeEventListener("abort",aborted);}};
      signal?.addEventListener("abort",aborted,{once:true});
    });
  }
  async command(command:string,signal?:AbortSignal):Promise<string> {
    if(/[\r\n\0]/.test(command))throw new MachineFault("invalid-request","ZRCP commands cannot contain line breaks or NUL.");
    const response=this.#wait(signal);
    if(this.#failure===undefined)this.#socket.write(command+"\n");
    const reply=await response;
    if(/(?:^|\n)Error[.:]/i.test(reply))throw new MachineFault("protocol-error",`ZRCP rejected a validated operation: ${reply.slice(0,512)}`);
    return reply;
  }
  notify(command:string):void {if(this.#failure===undefined)this.#socket.write(command+"\n");}
  close():void {this.#socket.destroy();}
}
