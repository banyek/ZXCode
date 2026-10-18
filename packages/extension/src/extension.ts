import { registerWorkspaceNavigation } from "./workspace.js";
import { registerCodeActions } from "./code-actions.js";
import { registerFormatting } from "./format.js";
import { registerRenumber } from "./renumber.js";
import * as vscode from "vscode";
import { languageService } from "@zxcode/core";
import type { DocumentAnalysisSnapshot, SourceRange } from "@zxcode/core";
import { EditorDocuments } from "./documents.js";
import { EditorDiagnostics } from "./diagnostics.js";
import { EditorRunner } from "./run.js";
import { registerCommands } from "./commands.js";
import { registerNavigation } from "./navigation.js";
import { registerCompletion } from "./completion.js";
import { toEditorRange } from "./ranges.js";
export interface ZXCodeExtensionApi {
  readonly documents: EditorDocuments;
  readonly queries: typeof languageService;
  readonly runner: EditorRunner;
  toEditorRange(document: vscode.TextDocument, snapshot: DocumentAnalysisSnapshot, range: SourceRange): vscode.Range;
}
let runnerForShutdown: EditorRunner | undefined;
export function activate(context: vscode.ExtensionContext): ZXCodeExtensionApi {
  const documents = new EditorDocuments();
  const diagnostics = new EditorDiagnostics(documents);
  const output = vscode.window.createOutputChannel("ZXCode");
  const runner = new EditorRunner(documents,diagnostics,output);
  runnerForShutdown = runner;
  context.subscriptions.push(registerWorkspaceNavigation(documents), registerCodeActions(documents), registerFormatting(documents), registerRenumber(documents), registerCommands(documents, diagnostics, output), runner, registerCompletion(documents), registerNavigation(documents), diagnostics, documents, output);
  return Object.freeze({ documents, queries: languageService, toEditorRange, runner });
}

export async function deactivate(): Promise<void> {await runnerForShutdown?.shutdown();runnerForShutdown = undefined;}
