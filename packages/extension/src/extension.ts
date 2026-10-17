import * as vscode from "vscode";
import { languageService } from "@zxcode/core";
import type { DocumentAnalysisSnapshot, SourceRange } from "@zxcode/core";
import { EditorDocuments } from "./documents.js";
import { EditorDiagnostics } from "./diagnostics.js";
import { registerCompletion } from "./completion.js";
import { toEditorRange } from "./ranges.js";
export interface ZXCodeExtensionApi {
  readonly documents: EditorDocuments;
  readonly queries: typeof languageService;
  toEditorRange(document: vscode.TextDocument, snapshot: DocumentAnalysisSnapshot, range: SourceRange): vscode.Range;
}
export function activate(context: vscode.ExtensionContext): ZXCodeExtensionApi {
  const documents = new EditorDocuments();
  context.subscriptions.push(new EditorDiagnostics(documents), registerCompletion(documents), documents);
  return Object.freeze({ documents, queries: languageService, toEditorRange });
}
