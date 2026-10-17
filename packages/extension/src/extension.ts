import * as vscode from "vscode";
import { languageService } from "@zxcode/core";
import type { DocumentAnalysisSnapshot, SourceRange } from "@zxcode/core";
import { EditorDocuments } from "./documents.js";
export interface ZXCodeExtensionApi {
  readonly documents: EditorDocuments;
  readonly queries: typeof languageService;
  toEditorRange(document: vscode.TextDocument, snapshot: DocumentAnalysisSnapshot, range: SourceRange): vscode.Range;
}
export function toEditorRange(document: vscode.TextDocument, snapshot: DocumentAnalysisSnapshot, range: SourceRange): vscode.Range {
  if (document.uri.toString() !== snapshot.identity.documentId || document.version !== snapshot.identity.version || document.getText() !== snapshot.source.text) throw new Error("Cannot convert a stale document snapshot.");
  if (range.sourceId !== snapshot.source.id) throw new TypeError("Range belongs to a different document.");
  snapshot.source.range(range.start, range.end);
  return new vscode.Range(document.positionAt(range.start), document.positionAt(range.end));
}
export function activate(context: vscode.ExtensionContext): ZXCodeExtensionApi {
  const documents = new EditorDocuments();
  context.subscriptions.push(documents, vscode.workspace.onDidCloseTextDocument((document) => documents.close(document)));
  return Object.freeze({ documents, queries: languageService, toEditorRange });
}
