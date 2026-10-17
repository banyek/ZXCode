import type { TextDocument } from "vscode";
import { createDocumentSession, SourceDocument } from "@zxcode/core";
import type { DocumentAnalysisSession, DocumentAnalysisSnapshot } from "@zxcode/core";
/** Editor lifecycle ownership only; all language state lives in core sessions. */
export class EditorDocuments {
  #disposed = false;
  readonly #documents = new Map<string, { document: TextDocument; session: DocumentAnalysisSession }>();
  snapshot(document: TextDocument): DocumentAnalysisSnapshot {
    if (this.#disposed) throw new Error("Editor document adapter is disposed.");
    const id = document.uri.toString();
    let record = this.#documents.get(id);
    if (record === undefined || record.document !== document) {
      record = { document, session: createDocumentSession({ source: new SourceDocument(id, document.getText()), version: document.version }) };
      this.#documents.set(id, record);
    } else if (document.version !== record.session.current.identity.version) {
      record.session.update({ source: new SourceDocument(id, document.getText()), version: document.version });
    }
    return record.session.current;
  }
  close(document: TextDocument): void {
    const id = document.uri.toString();
    if (this.#documents.get(id)?.document === document) this.#documents.delete(id);
  }
  dispose(): void { this.#documents.clear(); this.#disposed = true; }
}
