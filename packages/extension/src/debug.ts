import * as vscode from "vscode";
import {isAbsolute,basename} from "node:path";
import {createZrcpBackend,startBasicDebugging} from "@zxcode/runner";
import type {BasicDebugSession,BasicBreakpointRequest} from "@zxcode/runner";
import type {DocumentAnalysisSnapshot} from "@zxcode/core";
import type {EditorDocuments} from "./documents.js";
import {LANGUAGE_ID} from "./language.js";
interface Request {readonly type:"request";readonly seq:number;readonly command:string;readonly arguments?:unknown}
const object=(value:unknown):Record<string,unknown>=>value!==null&&typeof value==="object"&&!Array.isArray(value)?value as Record<string,unknown>:{};
class BasicInlineAdapter implements vscode.DebugAdapter {
  readonly #messages=new vscode.EventEmitter<vscode.DebugProtocolMessage>();readonly onDidSendMessage=this.#messages.event;
  readonly #subscriptions:vscode.Disposable[];readonly #documents:EditorDocuments;readonly #folder:vscode.WorkspaceFolder | undefined;readonly #onDispose:()=>void;
  #sequence=0;#tail:Promise<void>=Promise.resolve();#controller:BasicDebugSession | undefined;#document:vscode.TextDocument | undefined;#snapshot:DocumentAnalysisSnapshot | undefined;
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
        this.#response(request,{supportsConfigurationDoneRequest:true,supportsBreakpointLocationsRequest:true,supportsTerminateRequest:true,supportsRestartRequest:false,supportsConditionalBreakpoints:false,supportsHitConditionalBreakpoints:false,supportsLogPoints:false,exceptionBreakpointFilters:[]});return;
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
      case "scopes":this.#response(request,{scopes:[]});return;
      case "variables":this.#response(request,{variables:[]});return;
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
  readonly #adapters=new Set<BasicInlineAdapter>();readonly #subscriptions:vscode.Disposable[];#stopping=false;
  constructor(documents:EditorDocuments) {
    this.#subscriptions=[vscode.debug.registerDebugAdapterDescriptorFactory("zxcode-basic",{createDebugAdapterDescriptor:session=>{
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
  dispose():void {this.#stopping=true;for(const adapter of [...this.#adapters])adapter.dispose();for(const item of this.#subscriptions)item.dispose();}
}
