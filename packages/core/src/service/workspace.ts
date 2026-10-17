import { documentSymbols } from "./document-symbols.js";
import type { DocumentAnalysisSnapshot,DocumentSnapshotIdentity,LanguageSymbol } from "./contract.js";
export interface WorkspaceSymbol {readonly document:DocumentSnapshotIdentity;readonly symbol:LanguageSymbol}
export interface WorkspaceSymbolResult {readonly snapshots:readonly DocumentSnapshotIdentity[];readonly value:readonly WorkspaceSymbol[]}
/** Discovery is host-owned; language identities and references stay per document. */
export function workspaceSymbols(snapshots:readonly DocumentAnalysisSnapshot[],query=""):WorkspaceSymbolResult {
  const ordered=[...snapshots].sort((a,b)=>a.identity.documentId < b.identity.documentId ? -1 : a.identity.documentId > b.identity.documentId ? 1 : 0);
  if(new Set(ordered.map(snapshot=>snapshot.identity.documentId)).size !== ordered.length) throw new TypeError("Workspace snapshots must have distinct document identities.");
  const needle=query.trim().toUpperCase(), symbols:WorkspaceSymbol[]=[];
  for(const snapshot of ordered) {
    const pending=[...documentSymbols(snapshot).value];
    while(pending.length > 0) {
      const symbol=pending.pop()!;
      pending.push(...(symbol.children ?? []));
      if(symbol.kind !== "parameter" && symbol.name.toUpperCase().includes(needle)) symbols.push(Object.freeze({document:snapshot.identity,symbol}));
    }
  }
  symbols.sort((a,b)=>a.document.documentId < b.document.documentId ? -1 : a.document.documentId > b.document.documentId ? 1 : a.symbol.selectionRange.start-b.symbol.selectionRange.start);
  return Object.freeze({snapshots:Object.freeze(ordered.map(snapshot=>snapshot.identity)),value:Object.freeze(symbols)});
}
