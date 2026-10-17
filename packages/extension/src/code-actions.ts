import * as vscode from "vscode";
import { languageService } from "@zxcode/core";
import type { EditorDocuments } from "./documents.js";
import { toEditorDiagnostic } from "./diagnostics.js";
import { toEditorRange } from "./ranges.js";
export function registerCodeActions(documents:EditorDocuments):vscode.Disposable {
  return vscode.languages.registerCodeActionsProvider({language:"zx-spectrum-basic"},{
    provideCodeActions(document,range,context,cancellation) {
      if (cancellation.isCancellationRequested || (context.only !== undefined && !context.only.contains(vscode.CodeActionKind.QuickFix))) return [];
      const snapshot = documents.snapshot(document);
      const result = languageService.codeActions(snapshot,snapshot.source.range(document.offsetAt(range.start),document.offsetAt(range.end)));
      if (cancellation.isCancellationRequested || documents.snapshot(document).identity !== result.snapshot) return [];
      return result.value.map(action => {
        const native = new vscode.CodeAction(action.title,vscode.CodeActionKind.QuickFix);
        native.diagnostics = action.diagnostics.map(diagnostic => toEditorDiagnostic(document,snapshot,diagnostic));
        native.edit = new vscode.WorkspaceEdit();
        for (const edit of action.edits) native.edit.replace(document.uri,toEditorRange(document,snapshot,edit.range),edit.newText);
        return native;
      });
    }
  },{providedCodeActionKinds:[vscode.CodeActionKind.QuickFix]});
}
