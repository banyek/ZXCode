import { EditorDebugger } from "./debug.js";
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
let debuggerForShutdown:EditorDebugger | undefined;
let runnerForShutdown: EditorRunner | undefined;
export function activate(context: vscode.ExtensionContext): ZXCodeExtensionApi {
  const documents = new EditorDocuments();
  const diagnostics = new EditorDiagnostics(documents);
  const output = vscode.window.createOutputChannel("ZXCode");
  const runner = new EditorRunner(documents,diagnostics,output);
  runnerForShutdown = runner;
  const debuggerAdapter = new EditorDebugger(documents);debuggerForShutdown=debuggerAdapter;
  context.subscriptions.push(debuggerAdapter, registerWorkspaceNavigation(documents), registerCodeActions(documents), registerFormatting(documents), registerRenumber(documents), registerCommands(documents, diagnostics, output), runner, registerCompletion(documents), registerNavigation(documents), diagnostics, documents, output);
  return Object.freeze({ documents, queries: languageService, toEditorRange, runner });
}

export async function deactivate(): Promise<void> {await debuggerForShutdown?.shutdown();debuggerForShutdown=undefined;await runnerForShutdown?.shutdown();runnerForShutdown = undefined;}
