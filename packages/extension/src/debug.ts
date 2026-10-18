import * as vscode from "vscode";
import {isAbsolute,basename} from "node:path";
import {createZrcpBackend,startBasicDebugging,inspectBasicVariables,readPausedMemory,runtimeVariableNodes,selectBasicWatch} from "@zxcode/runner";
import type {BasicDebugSession,BasicBreakpointRequest,RuntimeVariableNode,MachineStop} from "@zxcode/runner";
import type {DocumentAnalysisSnapshot} from "@zxcode/core";
import type {EditorDocuments} from "./documents.js";
import {LANGUAGE_ID} from "./language.js";
interface Request {readonly type:"request";readonly seq:number;readonly command:string;readonly arguments?:unknown}
const object=(value:unknown):Record<string,unknown>=>value!==null&&typeof value==="object"&&!Array.isArray(value)?value as Record<string,unknown>:{};
class BasicInlineAdapter implements vscode.DebugAdapter {
  readonly #messages=new vscode.EventEmitter<vscode.DebugProtocolMessage>();readonly onDidSendMessage=this.#messages.event;
  readonly #subscriptions:vscode.Disposable[];readonly #documents:EditorDocuments;readonly #folder:vscode.WorkspaceFolder | undefined;readonly #onDispose:()=>void;
  #sequence=0;#tail:Promise<void>=Promise.resolve();#controller:BasicDebugSession | undefined;#document:vscode.TextDocument | undefined;#snapshot:DocumentAnalysisSnapshot | undefined;
  #variableStop:MachineStop | undefined;#variableRoot=0;#nextVariableReference=100;readonly #variableNodes=new Map<number,readonly RuntimeVariableNode[]|RuntimeVariableNode>();
  #startup:AbortController | undefined;#terminateRequested=false;#shutdown:Promise<void> | undefined;#stopOnEntry=true;#supportsInvalidated=false;#disposed=false;
  constructor(documents:EditorDocuments,folder:vscode.WorkspaceFolder | undefined,onDispose:()=>void) {
    this.#documents=documents;this.#folder=folder;this.#onDispose=onDispose;
    const changed=(document:vscode.TextDocument):void=>{if(document===this.#document){this.#startup?.abort();this.#controller?.invalidateSource();}};
    this.#subscriptions=[vscode.workspace.onDidChangeTextDocument(event=>changed(event.document)),vscode.workspace.onDidCloseTextDocument(changed)];
  }
  #send(message:Record<string,unknown>):void {if(!this.#disposed)this.#messages.fire({...message,seq:++this.#sequence});}
  #event(event:string,body?:unknown):void {this.#send({type:"event",event,...(body===undefined?{}:{body})});}
  #response(request:Request,body?:unknown):void {this.#send({type:"response",request_seq:request.seq,success:true,command:request.command,...(body===undefined?{}:{body})});}
  #error(request:Request,message:string):void {this.#send({type:"response",request_seq:request.seq,success:false,command:request.command,message,body:{error:{id:1,format:message,showUser:true}}});}
  #source():Record<string,unknown> {const document=this.#document;return {name:document===undefined?"BASIC":basename(document.uri.path),path:document?.uri.scheme==="file"?document.uri.fsPath:document?.uri.toString()};}
  #uri(path:unknown):vscode.Uri | undefined {
    if(typeof path!=="string"||path==="")return undefined;
    if(isAbsolute(path))return vscode.Uri.file(path);
    if(/^[A-Za-z][A-Za-z0-9+.-]*:/.test(path))return vscode.Uri.parse(path);
    return this.#folder===undefined?undefined:vscode.Uri.joinPath(this.#folder.uri,path);
  }
  #sameSource(source:unknown):boolean {const uri=this.#uri(object(source).path);return uri!==undefined&&uri.toString()===this.#document?.uri.toString();}
  #current():boolean {return this.#document!==undefined&&!this.#document.isClosed&&this.#document.languageId===LANGUAGE_ID&&this.#snapshot!==undefined&&this.#documents.snapshot(this.#document).identity===this.#snapshot.identity;}
  #clearVariables():void {this.#variableStop=undefined;this.#variableNodes.clear();this.#variableRoot=0;}
  async #verifyVariableStop():Promise<void> {
    if(!this.#controller||!this.#variableStop)throw new Error("Pause and refresh the BASIC variables.");
    const current=await this.#controller.inspect({});
    if(current.kind==="error"||current.value.stop!==this.#variableStop){this.#clearVariables();throw new Error("Runtime state changed; refresh after pausing.");}
  }
  #variable(node:RuntimeVariableNode):Record<string,unknown> {
    let reference=0;if(node.childCount>0){reference=this.#nextVariableReference++;this.#variableNodes.set(reference,node);}
    return {name:node.name,value:node.display,type:node.type,variablesReference:reference,...(node.childCount>0?(node.type==="number-array"||node.type==="character-array"?{indexedVariables:node.childCount}:{namedVariables:node.childCount}):{}),...(node.address===undefined?{}:{memoryReference:String(node.address)})};
  }
  handleMessage(message:vscode.DebugProtocolMessage):void {
    if(this.#disposed)return;
    const request=message as Partial<Request>;
    if(request.type!=="request"||!Number.isSafeInteger(request.seq)||typeof request.command!=="string")return;
    if(request.command==="disconnect"||request.command==="terminate") {this.#terminateRequested=true;this.#startup?.abort();}
    this.#tail=this.#tail.then(()=>this.#handle(request as Request)).catch(error=>this.#error(request as Request,error instanceof Error?error.message:String(error)));
  }
  async #handle(request:Request):Promise<void> {
    const args=object(request.arguments);
    switch(request.command) {
      case "initialize":
        this.#supportsInvalidated=args.supportsInvalidatedEvent===true;
        this.#response(request,{supportsEvaluateForHovers:true,supportsReadMemoryRequest:true,supportsConfigurationDoneRequest:true,supportsBreakpointLocationsRequest:true,supportsTerminateRequest:true,supportsRestartRequest:false,supportsConditionalBreakpoints:false,supportsHitConditionalBreakpoints:false,supportsLogPoints:false,exceptionBreakpointFilters:[]});return;
      case "launch": {
        if(!vscode.workspace.isTrusted)throw new Error("Trust this workspace before launching the debugger.");
        if(args.noDebug===true)throw new Error("Use ZXCode: Run Spectrum for a non-debug emulator run.");
        const uri=this.#uri(args.program)??vscode.window.activeTextEditor?.document.uri;
        if(uri===undefined)throw new Error("Open or select a Spectrum BASIC program to debug.");
        const document=await vscode.workspace.openTextDocument(uri);
        if(document.uri.scheme!=="file")throw new Error("Save the BASIC program to a local file before native source debugging; dirty editor changes are supported.");
        if(document.languageId!==LANGUAGE_ID)throw new Error("Select ZX Spectrum BASIC language mode before debugging this document.");
        if(this.#terminateRequested||this.#disposed)throw new Error("Debug launch cancelled.");
        this.#document=document;this.#snapshot=this.#documents.snapshot(document);this.#startup=new AbortController();
        const executable=typeof args.zesaruxExecutable==="string"?args.zesaruxExecutable:vscode.workspace.getConfiguration("zxcode",uri).get<string>("debug.executable","");
        if(executable==="")throw new Error("Configure zxcode.debug.executable with the optional loopback-capable ZEsarUX 13.0 executable.");
        const launched=await startBasicDebugging({source:this.#snapshot.source,version:this.#snapshot.identity.version},createZrcpBackend({executable}),this.#startup.signal);
        if(launched.kind==="error")throw new Error(launched.message);
        this.#controller=launched.value;
        if(!this.#current()||this.#startup.signal.aborted) {await this.#controller.close();throw new Error("BASIC source changed during launch; restart debugging.");}
        this.#stopOnEntry=args.stopOnEntry!==false;
        this.#controller.subscribe(event=>{
          if(event.kind==="running"||event.kind==="stopped"||event.kind==="invalidated"||event.kind==="terminated")this.#clearVariables();
          if(event.kind==="running")this.#event("continued",{threadId:1,allThreadsContinued:true});
          else if(event.kind==="invalidated") {
            if(this.#supportsInvalidated)this.#event("invalidated",{areas:["stacks","variables"]});
            else this.#event("stopped",{reason:"pause",threadId:1,allThreadsStopped:true,description:"Source changed; restarting is required."});
          } else if(event.kind==="stopped")this.#event("stopped",{reason:event.reason==="unmapped"?"pause":event.reason,threadId:1,allThreadsStopped:true,...(event.message===undefined?{}:{description:event.message})});
          else if(event.kind==="output")this.#event("output",{category:"console",output:event.message});
          else if(event.kind==="terminated") {this.#event("output",{category:"console",output:event.message+"\n"});this.#event("terminated");}
        });
        this.#response(request);this.#event("initialized");return;
      }
      case "setBreakpoints": {
        const entries=Array.isArray(args.breakpoints)?args.breakpoints.map(object):[];
        if(!this.#controller||!this.#sameSource(args.source)||!this.#current()) {this.#response(request,{breakpoints:entries.map(item=>({verified:false,line:item.line,message:"This debug session owns one unchanged BASIC document."}))});return;}
        const accepted:BasicBreakpointRequest[]=entries.filter(item=>!item.condition&&!item.hitCondition&&!item.logMessage).map(item=>({line:typeof item.line==="number"?item.line:0,...(typeof item.column==="number"?{column:item.column}:{})}));
        const bound=[...this.#controller.setBreakpoints(accepted)];
        this.#response(request,{breakpoints:entries.map(item=>item.condition||item.hitCondition||item.logMessage?{verified:false,line:item.line,message:"Conditional and log breakpoints are not supported."}:bound.shift())});return;
      }
      case "breakpointLocations": {
        const source=this.#controller?.image.source;
        const locations=this.#controller&&source&&this.#sameSource(args.source)&&this.#current()?this.#controller.image.sourceMap.flatMap(line=>line.statements.flatMap(statement=>{
          if(!statement.encodedRange?.length)return [];
          const start=source.positionAt(statement.sourceRange.start),end=source.positionAt(statement.sourceRange.end);
          return start.line+1>=Number(args.line)&&start.line+1<=Number(args.endLine??args.line)?[{line:start.line+1,column:start.column+1,endLine:end.line+1,endColumn:end.column+1}]:[];
        })):[];this.#response(request,{breakpoints:locations});return;
      }
      case "configurationDone": {
        if(!this.#controller)throw new Error("Start a BASIC debug session first.");
        const result=await this.#controller.begin(this.#stopOnEntry);if(result.kind==="error")throw new Error(result.message);this.#response(request);return;
      }
      case "threads":this.#response(request,{threads:[{id:1,name:"Spectrum BASIC"}]});return;
      case "stackTrace": {
        const location=this.#current()?this.#controller?.currentLocation:undefined;
        if(location===undefined) {this.#response(request,{stackFrames:[],totalFrames:0});return;}
        const end=this.#controller!.image.source.positionAt(location.sourceRange.end);
        this.#response(request,{stackFrames:[{id:1,name:`BASIC ${location.basicLine}:${location.statement}`,source:this.#source(),line:location.position.line+1,column:location.position.column+1,endLine:end.line+1,endColumn:end.column+1}],totalFrames:1});return;
      }
      case "scopes": {
        if(!this.#controller)throw new Error("No active BASIC debug machine.");
        if(this.#variableRoot===0) {
          const result=await inspectBasicVariables(this.#controller);if(result.kind==="error")throw new Error(result.message);
          this.#variableStop=result.value.stop;this.#variableRoot=this.#nextVariableReference++;this.#variableNodes.set(this.#variableRoot,runtimeVariableNodes(result.value));
        }
        await this.#verifyVariableStop();
        this.#response(request,{scopes:[{name:"48K BASIC variables",presentationHint:"locals",variablesReference:this.#variableRoot,expensive:false}]});return;
      }
      case "variables": {
        await this.#verifyVariableStop();const handle=this.#variableNodes.get(Number(args.variablesReference));
        if(handle===undefined){this.#response(request,{variables:[]});return;}
        const indexed=!Array.isArray(handle)&&((handle as RuntimeVariableNode).type==="number-array"||(handle as RuntimeVariableNode).type==="character-array");
        if(args.filter==="indexed"&&!indexed||args.filter==="named"&&indexed){this.#response(request,{variables:[]});return;}
        const start=Number(args.start??0),count=Number(args.count??0);
        if(!Number.isSafeInteger(start)||!Number.isSafeInteger(count)||start<0||count<0)throw new Error("Use nonnegative variable page bounds.");
        const nodes=Array.isArray(handle)?handle.slice(start,count===0?undefined:start+count):(handle as RuntimeVariableNode).children(start,count);
        this.#response(request,{variables:nodes.map(node=>this.#variable(node))});return;
      }
      case "evaluate": {
        if(!this.#controller||typeof args.expression!=="string")throw new Error("Pause a BASIC debug session before inspecting watches.");
        const result=await inspectBasicVariables(this.#controller);if(result.kind==="error")throw new Error(result.message);
        const node=selectBasicWatch(result.value,args.expression),current=await this.#controller.inspect({});
        if(current.kind==="error"||current.value.stop!==result.value.stop)throw new Error("Watch snapshot is no longer current.");
        if(this.#variableStop!==result.value.stop){this.#clearVariables();this.#variableStop=result.value.stop;}
        const value=this.#variable(node);this.#response(request,{...value,result:node.display});return;
      }
      case "readMemory": {
        if(!this.#controller)throw new Error("No active debug machine.");
        const reference=typeof args.memoryReference==="string"?args.memoryReference:"";
        if(!/^(?:0x[0-9a-fA-F]+|[0-9]+)$/.test(reference))throw new Error("Memory reference must be a decimal or hexadecimal 16-bit address.");
        const address=Number(reference)+Number(args.offset??0),length=Number(args.count);
        const result=await readPausedMemory(this.#controller,address,length);if(result.kind==="error")throw new Error(result.message);
        this.#response(request,{address:"0x"+address.toString(16).toUpperCase(),data:Buffer.from(result.value.memory[0]!.bytes).toString("base64"),unreadableBytes:0});return;
      }
      case "setExceptionBreakpoints":this.#response(request,{breakpoints:[]});return;
      case "continue":case "pause": {
        if(!this.#controller)throw new Error("No active BASIC debug machine.");
        const result=await(request.command==="continue"?this.#controller.continue():this.#controller.pause());
        if(result.kind==="error")throw new Error(result.message);this.#response(request,request.command==="continue"?{allThreadsContinued:true}:undefined);return;
      }
      case "disconnect":case "terminate":await this.#controller?.close();this.#response(request);return;
      case "next":case "stepIn":case "stepOut":throw new Error("BASIC stepping is not available yet; use Continue or source breakpoints.");
      default:throw new Error(`Unsupported BASIC debugger request: ${request.command}.`);
    }
  }
  shutdown():Promise<void> {
    if(this.#shutdown!==undefined)return this.#shutdown;this.#terminateRequested=true;this.#startup?.abort();
    this.#shutdown=(async()=>{await this.#tail;await this.#controller?.close();})();return this.#shutdown;
  }
  dispose():void {if(this.#disposed)return;this.#disposed=true;this.#startup?.abort();for(const item of this.#subscriptions)item.dispose();this.#messages.dispose();void this.shutdown().finally(this.#onDispose);}
}
export class EditorDebugger implements vscode.Disposable {
  readonly #adapters=new Set<BasicInlineAdapter>();readonly #subscriptions:vscode.Disposable[];#stopping=false;readonly #memoryDocuments=new Map<string,string>();#memorySequence=0;
  constructor(documents:EditorDocuments) {
    this.#subscriptions=[vscode.workspace.registerTextDocumentContentProvider("zxcode-memory",{provideTextDocumentContent:uri=>this.#memoryDocuments.get(uri.toString())??""}),
      vscode.workspace.onDidCloseTextDocument(document=>{if(document.uri.scheme==="zxcode-memory")this.#memoryDocuments.delete(document.uri.toString());}),
      vscode.commands.registerCommand("zxcode.viewMemory",async(address?:number,count?:number)=>{
        const session=vscode.debug.activeDebugSession;if(session?.type!=="zxcode-basic"){void vscode.window.showWarningMessage("Start and pause a ZXCode BASIC debug session first.");return;}
        if(address===undefined||count===undefined) {
          const text=await vscode.window.showInputBox({title:"View Spectrum Memory",prompt:"Address, byte count (decimal or 0x hexadecimal address)",value:"0x4000,256"});if(text===undefined)return;
          const fields=text.split(",");address=Number(fields[0]);count=Number(fields[1]);
        }
        if(!Number.isSafeInteger(address)||!Number.isSafeInteger(count)||address<0||count<1||address+count>65536){void vscode.window.showWarningMessage("Choose a non-wrapping 16-bit memory range.");return;}
        try {
          const result=await session.customRequest("readMemory",{memoryReference:String(address),count}) as {data:string};
          const bytes=Buffer.from(result.data,"base64"),rows=["ZXCode memory snapshot","Captured while paused; historical after execution resumes.",""];
          for(let offset=0;offset<bytes.length;offset+=16)rows.push((address+offset).toString(16).toUpperCase().padStart(4,"0")+": "+Array.from(bytes.slice(offset,offset+16),byte=>byte.toString(16).toUpperCase().padStart(2,"0")).join(" "));
          const uri=vscode.Uri.parse(`zxcode-memory:/${session.id}/memory-${++this.#memorySequence}.hex`);this.#memoryDocuments.set(uri.toString(),rows.join("\n")+"\n");await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(uri),{preview:true});return uri;
        } catch(error){void vscode.window.showWarningMessage(error instanceof Error?error.message:"Memory is unavailable until the machine is paused.");return;}
      }),vscode.debug.registerDebugAdapterDescriptorFactory("zxcode-basic",{createDebugAdapterDescriptor:session=>{
      if(this.#stopping)throw new Error("The BASIC debugger is shutting down.");
      const adapter=new BasicInlineAdapter(documents,session.workspaceFolder,()=>this.#adapters.delete(adapter));this.#adapters.add(adapter);return new vscode.DebugAdapterInlineImplementation(adapter);
    }}),vscode.debug.registerDebugConfigurationProvider("zxcode-basic",{resolveDebugConfiguration(_folder,configuration){
      if(!configuration.type)return {type:"zxcode-basic",request:"launch",name:"ZXCode: Debug BASIC",program:vscode.window.activeTextEditor?.document.uri.toString(),stopOnEntry:true};return configuration;
    }}),vscode.commands.registerCommand("zxcode.debug",async()=>{
      if(this.#stopping)return false;
      const document=vscode.window.activeTextEditor?.document;if(document?.languageId!==LANGUAGE_ID)return false;
      return vscode.debug.startDebugging(vscode.workspace.getWorkspaceFolder(document.uri),{type:"zxcode-basic",request:"launch",name:"ZXCode: Debug BASIC",program:document.uri.toString(),stopOnEntry:true});
    })];
  }
  async shutdown():Promise<void> {this.#stopping=true;await Promise.all([...this.#adapters].map(adapter=>adapter.shutdown()));}
  dispose():void {this.#stopping=true;for(const adapter of [...this.#adapters])adapter.dispose();for(const item of this.#subscriptions)item.dispose();this.#memoryDocuments.clear();}
}
