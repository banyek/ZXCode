import * as vscode from "vscode";
import { languageService } from "@zxcode/core";
import type { DocumentAnalysisSnapshot, LanguageSymbol } from "@zxcode/core";
import { EditorDocuments } from "./documents.js";
import { LANGUAGE_ID } from "./language.js";
import { toEditorRange } from "./ranges.js";
import { toEditorDocumentation } from "./documentation.js";
const kinds: Readonly<Record<LanguageSymbol["kind"], vscode.SymbolKind>> = {
  line: vscode.SymbolKind.Number, variable: vscode.SymbolKind.Variable,
  array: vscode.SymbolKind.Array, function: vscode.SymbolKind.Function,
  parameter: vscode.SymbolKind.Variable
};
function current(document: vscode.TextDocument, snapshot: DocumentAnalysisSnapshot, token: vscode.CancellationToken): boolean {
  return !token.isCancellationRequested && !document.isClosed && document.languageId === LANGUAGE_ID && document.version === snapshot.identity.version && document.getText() === snapshot.source.text;
}
export function registerNavigation(documents: EditorDocuments): vscode.Disposable {
  const selector = {language: LANGUAGE_ID};
  const snapshotFor = (document: vscode.TextDocument, token: vscode.CancellationToken): DocumentAnalysisSnapshot | undefined => token.isCancellationRequested || document.isClosed || document.languageId !== LANGUAGE_ID ? undefined : documents.snapshot(document);
  return vscode.Disposable.from(
    vscode.languages.registerHoverProvider(selector, {
      provideHover(document, position, token) {
        const snapshot = snapshotFor(document, token);
        if (snapshot === undefined) return;
        const hover = languageService.hover(snapshot, document.offsetAt(position)).value;
        if (hover === undefined || !current(document, snapshot, token)) return;
        return new vscode.Hover(toEditorDocumentation(hover.documentation), toEditorRange(document, snapshot, hover.range));
      }
    }),
    vscode.languages.registerDefinitionProvider(selector, {
      provideDefinition(document, position, token) {
        const snapshot = snapshotFor(document, token);
        if (snapshot === undefined) return;
        const definitions = languageService.definitions(snapshot, document.offsetAt(position)).value;
        if (!current(document, snapshot, token)) return;
        return definitions.map((range) => new vscode.Location(document.uri, toEditorRange(document, snapshot, range)));
      }
    }),
    vscode.languages.registerReferenceProvider(selector, {
      provideReferences(document, position, context, token) {
        const snapshot = snapshotFor(document, token);
        if (snapshot === undefined) return;
        const references = languageService.references(snapshot, document.offsetAt(position), {includeDeclaration: context.includeDeclaration}).value;
        if (!current(document, snapshot, token)) return;
        return references.map((range) => new vscode.Location(document.uri, toEditorRange(document, snapshot, range)));
      }
    }),
    vscode.languages.registerDocumentSymbolProvider(selector, {
      provideDocumentSymbols(document, token) {
        const snapshot = snapshotFor(document, token);
        if (snapshot === undefined) return;
        const symbols = languageService.symbols(snapshot).value;
        if (!current(document, snapshot, token)) return;
        const convert = (symbol: LanguageSymbol): vscode.DocumentSymbol => {
          const result = new vscode.DocumentSymbol(symbol.name, symbol.detail ?? "", kinds[symbol.kind], toEditorRange(document, snapshot, symbol.range), toEditorRange(document, snapshot, symbol.selectionRange));
          result.children = (symbol.children ?? []).map(convert);
          return result;
        };
        return symbols.map(convert);
      }
    })
  );
}
