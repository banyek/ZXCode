import * as vscode from "vscode";
import { languageService } from "@zxcode/core";
import type { LanguageCompletionItem } from "@zxcode/core";
import { EditorDocuments } from "./documents.js";
import { LANGUAGE_ID } from "./language.js";
import { toEditorRange } from "./ranges.js";
import { toEditorDocumentation } from "./documentation.js";
const kinds: Readonly<Record<LanguageCompletionItem["kind"], vscode.CompletionItemKind>> = {
  command: vscode.CompletionItemKind.Keyword, keyword: vscode.CompletionItemKind.Keyword,
  function: vscode.CompletionItemKind.Function, variable: vscode.CompletionItemKind.Variable,
  array: vscode.CompletionItemKind.Variable, "line-number": vscode.CompletionItemKind.Reference,
  escape: vscode.CompletionItemKind.Text
};
export function registerCompletion(documents: EditorDocuments): vscode.Disposable {
  return vscode.languages.registerCompletionItemProvider({language: LANGUAGE_ID}, {
    provideCompletionItems(document, position, cancellation) {
      if (cancellation.isCancellationRequested || document.isClosed || document.languageId !== LANGUAGE_ID) return;
      const snapshot = documents.snapshot(document);
      const result = languageService.completions(snapshot, document.offsetAt(position)).value;
      if (cancellation.isCancellationRequested || document.isClosed || document.version !== snapshot.identity.version || document.getText() !== snapshot.source.text) return;
      return new vscode.CompletionList(result.items.map((candidate) => {
        const item = new vscode.CompletionItem(candidate.label, kinds[candidate.kind]);
        item.range = toEditorRange(document, snapshot, candidate.edit.range);
        item.insertText = candidate.edit.newText;
        item.filterText = candidate.label;
        if (candidate.sortKey !== undefined) item.sortText = candidate.sortKey;
        if (candidate.detail !== undefined) item.detail = candidate.detail;
        if (candidate.documentation !== undefined) item.documentation = toEditorDocumentation(candidate.documentation);
        return item;
      }), result.isIncomplete);
    }
  }, " ", "(", ",", ";", "=");
}
