import {randomUUID} from "node:crypto";
import {spawn,execFile} from "node:child_process";
import type {ChildProcess} from "node:child_process";
import {createServer} from "node:net";
import {isAbsolute} from "node:path";
import {promisify} from "node:util";
import {MachineFault,ZrcpTransport} from "./zrcp-transport.js";
const execute=promisify(execFile);
export interface ZrcpConfiguration {
  readonly executable?:string;
  readonly workingDirectory?:string;
  readonly attachPort?:number;
  readonly attachPrompt?:string;
  readonly commandTimeoutMs?:number;
}
export interface OwnedZrcp {readonly child:ChildProcess;readonly closed:Promise<void>;readonly stderr:()=>string}
export async function terminateZrcp(owned:OwnedZrcp | undefined):Promise<void> {
  if(owned===undefined)return;
  const wait=async(ms:number):Promise<boolean>=>{
    let timer:ReturnType<typeof setTimeout> | undefined;
    const done=await Promise.race([owned.closed.then(()=>true),new Promise<boolean>(resolve=>{timer=setTimeout(()=>resolve(false),ms);})]);
    if(timer!==undefined)clearTimeout(timer);return done;
  };
  if(await wait(200))return;
  owned.child.kill("SIGTERM");if(await wait(1500))return;
  owned.child.kill("SIGKILL");if(!await wait(1500))throw new MachineFault("runtime-failed","Owned ZEsarUX did not terminate after forced shutdown.");
}
export async function openZrcp(configuration:ZrcpConfiguration,mode:"launch" | "attach",signal?:AbortSignal):Promise<{transport:ZrcpTransport;owned?:OwnedZrcp}> {
  const timeout=configuration.commandTimeoutMs??5000;
  if(!Number.isSafeInteger(timeout)||timeout<50||timeout>30000)throw new MachineFault("invalid-request","Command timeout must be 50..30000 ms.");
  if(signal?.aborted)throw new MachineFault("cancelled","Debug startup cancelled.");
  if(mode==="attach") {
    const port=configuration.attachPort,prompt=configuration.attachPrompt??"command";
    if(!Number.isSafeInteger(port)||port!<1||port!>65535||!/^[A-Za-z0-9_-]{1,64}$/.test(prompt))throw new MachineFault("invalid-request","Configure a loopback attach port and an ASCII prompt.");
    return {transport:await ZrcpTransport.connect(port!,prompt,timeout,signal)};
  }
  if(process.platform==="win32")throw new MachineFault("unsupported-operation","Owned ZRCP launch is currently supported on Unix hosts; use explicit loopback attach on Windows.");
  const executable=configuration.executable;
  if(executable===undefined||!isAbsolute(executable)||configuration.workingDirectory!==undefined&&!isAbsolute(configuration.workingDirectory))throw new MachineFault("invalid-request","Owned debug launch requires an absolute executable and working directory.");
  const probe=async(args:string[]):Promise<string>=>{
    try {const result=await execute(executable,args,{timeout:2000,killSignal:"SIGKILL",maxBuffer:262144,...(signal===undefined?{}:{signal})});return result.stdout+result.stderr;}
    catch(error) {
      if(signal?.aborted)throw new MachineFault("cancelled","Debug startup cancelled.");
      const value=error as {stdout?:string;stderr?:string;code?:unknown};
      // ZEsarUX help intentionally exits nonzero after printing options.
      if(typeof value.code==="number" && value.stdout!==undefined)return value.stdout+(value.stderr??"");
      throw new MachineFault("runtime-failed",`ZEsarUX capability probe failed: ${error instanceof Error?error.message:String(error)}`);
    }
  };
  const version=await probe(["--version"]),help=await probe(["--noconfigfile","--experthelp"]);
  if(!/ZEsarUX/i.test(version)||!/\b13\.0\b/.test(version)||!help.includes("--remoteprotocol-loopback-only"))throw new MachineFault("unsupported-operation","Owned launch requires ZEsarUX 13.0 with the explicit loopback-only option patch; stock 13.0 is not launched.");
  const server=createServer();
  const port=await new Promise<number>((resolve,reject)=>{server.once("error",reject);server.listen(0,"127.0.0.1",()=>{const address=server.address();if(address===null||typeof address==="string")reject(new Error("No loopback port"));else resolve(address.port);});});
  await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
  const prompt=`zxcode-${randomUUID()}`;
  const args=["--noconfigfile","--no-saveconf-on-exit","--machine","48k","--vo","null","--ao","null","--nowelcomemessage","--nosplash","--stats-send-already-asked","--stats-disable-check-updates","--stats-disable-check-yesterday-users","--remoteprotocol-loopback-only","--enable-remoteprotocol","--remoteprotocol-port",String(port),"--remoteprotocol-prompt",prompt];
  const child=spawn(executable,args,{shell:false,stdio:["ignore","ignore","pipe"],...(configuration.workingDirectory===undefined?{}:{cwd:configuration.workingDirectory})});
  let stderr="",exit=false;
  const closed=new Promise<void>(resolve=>{child.once("error",()=>{exit=true;resolve();});child.once("close",()=>{exit=true;resolve();});});
  child.stderr?.on("data",data=>{stderr=(stderr+String(data)).slice(-4096);});
  const owned={child,closed,stderr:()=>stderr};
  try {
    const deadline=Date.now()+5000;
    while(Date.now()<deadline) {
      if(signal?.aborted)throw new MachineFault("cancelled","Debug startup cancelled.");
      if(exit)throw new MachineFault("runtime-failed",`Owned ZEsarUX exited during startup. ${stderr}`);
      try {return {transport:await ZrcpTransport.connect(port,prompt,timeout,signal),owned};}
      catch(error) {if(signal?.aborted)throw error;await new Promise(resolve=>setTimeout(resolve,25));}
    }
    throw new MachineFault("timeout",`Owned ZEsarUX did not expose its loopback prompt. ${stderr}`);
  } catch(error) {await terminateZrcp(owned);throw error;}
}
