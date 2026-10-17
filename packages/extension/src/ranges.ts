import * as vscode from "vscode";
import type { DocumentAnalysisSnapshot, SourceRange } from "@zxcode/core";
export function toEditorRange(document: vscode.TextDocument, snapshot: DocumentAnalysisSnapshot, range: SourceRange): vscode.Range {
  if (document.uri.toString() !== snapshot.identity.documentId || document.version !== snapshot.identity.version || document.getText() !== snapshot.source.text) throw new Error("Cannot convert a stale document snapshot.");
  if (range.sourceId !== snapshot.source.id) throw new TypeError("Range belongs to a different document.");
  snapshot.source.range(range.start, range.end);
  return new vscode.Range(document.positionAt(range.start), document.positionAt(range.end));
}
