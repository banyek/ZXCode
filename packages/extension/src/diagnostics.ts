import * as vscode from "vscode";
import { languageService } from "@zxcode/core";
import type { Diagnostic, DiagnosticSeverity, DocumentAnalysisSnapshot } from "@zxcode/core";
import { EditorDocuments } from "./documents.js";
import { toEditorRange } from "./ranges.js";
import { LANGUAGE_ID } from "./language.js";
const severities: Readonly<Record<DiagnosticSeverity, vscode.DiagnosticSeverity>> = Object.freeze({
  error: vscode.DiagnosticSeverity.Error,
  warning: vscode.DiagnosticSeverity.Warning,
  information: vscode.DiagnosticSeverity.Information,
  hint: vscode.DiagnosticSeverity.Hint
});
export function toEditorDiagnostic(document: vscode.TextDocument, snapshot: DocumentAnalysisSnapshot, diagnostic: Diagnostic): vscode.Diagnostic {
  const result = new vscode.Diagnostic(toEditorRange(document,snapshot,diagnostic.range),diagnostic.message,severities[diagnostic.severity]);
  result.code = diagnostic.code;
  result.source = "ZXCode";
  if (diagnostic.related !== undefined) result.relatedInformation = diagnostic.related.map((related) => new vscode.DiagnosticRelatedInformation(new vscode.Location(document.uri,toEditorRange(document,snapshot,related.range)),related.message));
  return result;
}
/** Own one Problems collection; every acceptance decision remains in the core. */
export class EditorDiagnostics implements vscode.Disposable {
  readonly #collection = vscode.languages.createDiagnosticCollection("zxcode");
  readonly #published = new Map<string,vscode.TextDocument>();
  readonly #subscriptions: vscode.Disposable[];
  #disposed = false;
  constructor(readonly documents: EditorDocuments) {
    this.#subscriptions = [
      vscode.workspace.onDidOpenTextDocument((document) => this.refresh(document)),
      vscode.workspace.onDidChangeTextDocument((event) => this.refresh(event.document)),
      vscode.workspace.onDidCloseTextDocument((document) => this.#close(document))
    ];
    for (const document of vscode.workspace.textDocuments) this.refresh(document);
  }
  refresh(document: vscode.TextDocument): void {
    if (this.#disposed) return;
    const id = document.uri.toString();
    if (document.isClosed) { this.#close(document); return; }
    if (document.languageId !== LANGUAGE_ID) {
      this.#collection.delete(document.uri);
      this.#published.delete(id);
      this.documents.close(document);
      return;
    }
    const snapshot = this.documents.snapshot(document);
    const diagnostics = languageService.diagnostics(snapshot).value.map((diagnostic) => toEditorDiagnostic(document,snapshot,diagnostic));
    if (document.isClosed || document.version !== snapshot.identity.version || document.getText() !== snapshot.source.text) return;
    this.#collection.set(document.uri,diagnostics);
    this.#published.set(id,document);
  }
  #close(document: vscode.TextDocument): void {
    const id = document.uri.toString();
    if (this.#published.get(id) === document) { this.#collection.delete(document.uri); this.#published.delete(id); }
    this.documents.close(document);
  }
  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    for (const subscription of this.#subscriptions) subscription.dispose();
    this.#published.clear();
    this.#collection.dispose();
  }
}
