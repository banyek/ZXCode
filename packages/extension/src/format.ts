import * as vscode from "vscode";
import { formatDocument } from "@zxcode/core";
import type { EditorDocuments } from "./documents.js";
import { toEditorRange } from "./ranges.js";
export function registerFormatting(documents:EditorDocuments):vscode.Disposable {
  return vscode.languages.registerDocumentFormattingEditProvider({language:"zx-spectrum-basic"},{
    provideDocumentFormattingEdits(document,_options,cancellation) {
      if (cancellation.isCancellationRequested) return [];
      const snapshot = documents.snapshot(document), result = formatDocument(snapshot);
      if (result.value.kind === "blocked" || cancellation.isCancellationRequested || documents.snapshot(document).identity !== result.snapshot) return [];
      return result.value.edits.map(edit => vscode.TextEdit.replace(toEditorRange(document,snapshot,edit.range),edit.newText));
    }
  });
}
