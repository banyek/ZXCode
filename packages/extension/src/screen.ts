import * as vscode from "vscode";
import {randomUUID} from "node:crypto";
import {decodeSpectrumScreen} from "@zxcode/core";
/** Screen UI consumes DAP only; emulator protocol and machine ownership stay in runner. */
export class SpectrumScreen implements vscode.Disposable {
  readonly #subscriptions:vscode.Disposable[];readonly #panels=new Set<vscode.WebviewPanel>();
  readonly #states=new Map<string,{paused:boolean;revision:number}>();
  constructor() {
    this.#subscriptions=[vscode.debug.registerDebugAdapterTrackerFactory("zxcode-basic",{createDebugAdapterTracker:session=>{
      const state={paused:false,revision:0};this.#states.set(session.id,state);
      const update=(paused:boolean):void=>{state.paused=paused;state.revision++;};
      return {onDidSendMessage:message=>{if(message.type==="event"){if(message.event==="stopped")update(true);if(message.event==="continued"||message.event==="terminated")update(false);}},onExit:()=>{update(false);}};
    }}),vscode.commands.registerCommand("zxcode.showScreen",async()=>{
      const session=vscode.debug.activeDebugSession;if(session?.type!=="zxcode-basic")throw new Error("Start and pause a ZXCode debug session first.");
      const panel=vscode.window.createWebviewPanel("zxcode-screen","Spectrum Screen",vscode.ViewColumn.Beside,{enableScripts:true,localResourceRoots:[]});this.#panels.add(panel);
      const nonce=randomUUID().replaceAll("-","");
      panel.webview.html=`<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'"><style nonce="${nonce}">canvas{width:512px;max-width:100%;image-rendering:pixelated}body{color:var(--vscode-foreground);background:var(--vscode-editor-background)}</style></head><body><p id="state">No snapshot</p><button id="refresh">Refresh paused screen</button><label><input id="flash" type="checkbox">Flash phase 2</label><p><canvas width="256" height="192"></canvas></p><script nonce="${nonce}">
      const api=acquireVsCodeApi(),canvas=document.querySelector('canvas'),ctx=canvas.getContext('2d'),status=document.getElementById('state'),refresh=document.getElementById('refresh'),flash=document.getElementById('flash');
      let phases;function draw(){if(!phases)return;const image=ctx.createImageData(256,192),pixels=phases[flash.checked?1:0];for(let i=0;i<pixels.length;i++){const c=pixels[i],level=c&8?255:205;image.data[i*4]=c&2?level:0;image.data[i*4+1]=c&4?level:0;image.data[i*4+2]=c&1?level:0;image.data[i*4+3]=255;}ctx.putImageData(image,0,0);}
      refresh.onclick=()=>api.postMessage({type:'refresh'});flash.onchange=draw;window.addEventListener('message',e=>{const m=e.data;status.textContent=m.label;refresh.disabled=!m.paused;if(m.phases){phases=m.phases;draw();}});api.postMessage({type:'refresh'});
      </script></body></html>`;
      let capturedRevision=-1,disposed=false;
      const state=():{paused:boolean;revision:number}=>this.#states.get(session.id)??{paused:false,revision:0};
      const label=():string=>state().paused?(capturedRevision===state().revision?"Paused — captured screen":"Paused — refresh required; retained snapshot is historical"):"Running or ended — last paused snapshot (historical)";
      const refresh=async():Promise<void>=>{
        const before=state();if(!before.paused){await panel.webview.postMessage({label:label(),paused:false});return;}
        const revision=before.revision;
        try {
          const result=await session.customRequest("readMemory",{memoryReference:"16384",count:6912}) as {data:string};
          if(disposed||!state().paused||state().revision!==revision)return;
          const bytes=Buffer.from(result.data,"base64"),phases=[Array.from(decodeSpectrumScreen(bytes)),Array.from(decodeSpectrumScreen(bytes,true))];capturedRevision=revision;
          await panel.webview.postMessage({label:label(),paused:true,phases});
        } catch(error){if(!disposed)await panel.webview.postMessage({label:error instanceof Error?error.message:"Screen unavailable",paused:state().paused});}
      };
      const messages=panel.webview.onDidReceiveMessage(message=>{if(message?.type==="refresh")void refresh();});
      let previous=-1;
      const timer=setInterval(()=>{if(state().revision!==previous){previous=state().revision;void panel.webview.postMessage({label:label(),paused:state().paused});}},100);
      panel.onDidDispose(()=>{disposed=true;clearInterval(timer);messages.dispose();this.#panels.delete(panel);});
      return panel;
    })];
  }
  dispose():void {for(const panel of this.#panels)panel.dispose();for(const subscription of this.#subscriptions)subscription.dispose();this.#states.clear();}
}
