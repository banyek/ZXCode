import * as vscode from "vscode";
import { createDocumentSession,SourceDocument,workspaceSymbols } from "@zxcode/core";
import type { DocumentAnalysisSnapshot,LanguageSymbol } from "@zxcode/core";
import type { EditorDocuments } from "./documents.js";
import { LANGUAGE_ID } from "./language.js";
const exclude="**/{.git,node_modules,dist,artifacts,.vscode-test}/**";
const kinds:Readonly<Record<LanguageSymbol["kind"],vscode.SymbolKind>>={line:vscode.SymbolKind.Number,variable:vscode.SymbolKind.Variable,array:vscode.SymbolKind.Array,function:vscode.SymbolKind.Function,parameter:vscode.SymbolKind.Variable};
export function registerWorkspaceNavigation(documents:EditorDocuments):vscode.Disposable {
  let generation=0;
  const changed=():void=>{generation++;};
  const watcher=vscode.workspace.createFileSystemWatcher("**/*.zxbas");
  const subscriptions=[watcher,watcher.onDidChange(changed),watcher.onDidCreate(changed),watcher.onDidDelete(changed),vscode.workspace.onDidChangeWorkspaceFolders(changed),vscode.workspace.onDidOpenTextDocument(changed),vscode.workspace.onDidCloseTextDocument(changed),vscode.workspace.onDidChangeTextDocument(changed),vscode.workspace.onDidSaveTextDocument(changed)];
  const discover=async (token?:vscode.CancellationToken):Promise<readonly vscode.Uri[]>=>{
    const found=await vscode.workspace.findFiles("**/*.zxbas",exclude,undefined,token);
    const uris=new Map(found.map(uri=>[uri.toString(),uri]));
    for(const document of vscode.workspace.textDocuments) if(!document.isClosed && document.languageId === LANGUAGE_ID) uris.set(document.uri.toString(),document.uri);
    return [...uris.values()].sort((a,b)=>a.toString() < b.toString() ? -1 : a.toString() > b.toString() ? 1 : 0);
  };
  const symbols=vscode.languages.registerWorkspaceSymbolProvider({
    async provideWorkspaceSymbols(query,token) {
      const revision=generation;
      const uris=await discover(token), snapshots:DocumentAnalysisSnapshot[]=[];
      for(const uri of uris) {
        if(token.isCancellationRequested || revision !== generation) return [];
        const open=vscode.workspace.textDocuments.find(document=>document.uri.toString() === uri.toString() && !document.isClosed);
        if(open !== undefined) {if(open.languageId === LANGUAGE_ID) snapshots.push(documents.snapshot(open));continue;}
        let text:string;
        try {text=new TextDecoder("utf-8",{fatal:true,ignoreBOM:true}).decode(await vscode.workspace.fs.readFile(uri));}
        catch {continue; /* Unreadable/non-UTF-8 disk files are outside this query. */}
        snapshots.push(createDocumentSession({source:new SourceDocument(uri.toString(),text),version:0}).current);
      }
      if(token.isCancellationRequested || revision !== generation) return [];
      return workspaceSymbols(snapshots,query).value.map(item=>{
        const source=item.document.source, range=item.symbol.selectionRange;
        const start=source.positionAt(range.start), end=source.positionAt(range.end);
        const uri=vscode.Uri.parse(item.document.documentId);
        return new vscode.SymbolInformation(item.symbol.name,kinds[item.symbol.kind],vscode.workspace.asRelativePath(uri,true),new vscode.Location(uri,new vscode.Range(start.line,start.column,end.line,end.column)));
      });
    }
  });
  const open=vscode.commands.registerCommand("zxcode.openProgram",async ()=>{
    const uris=await discover();
    const selected=await vscode.window.showQuickPick(uris.map(uri=>({label:vscode.workspace.asRelativePath(uri,true),...(uri.scheme === "untitled" ? {description:"Unsaved BASIC program"} : {}),uri})),{title:"Open BASIC Program",placeHolder:"Each file is an independent Spectrum BASIC program"});
    if(selected !== undefined) await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(selected.uri));
  });
  return vscode.Disposable.from(...subscriptions,symbols,open);
}
