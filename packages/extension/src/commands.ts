import { stat } from "node:fs/promises";
import * as vscode from "vscode";
import { buildTap, checkProgram } from "@zxcode/core";
import { EditorDocuments } from "./documents.js";
import { EditorDiagnostics } from "./diagnostics.js";
import { LANGUAGE_ID } from "./language.js";
export interface EditorCommandResult { readonly kind: "success" | "error"; readonly output?: vscode.Uri; readonly message: string }
async function protectSource(source: vscode.Uri, output: vscode.Uri): Promise<void> {
  if (source.with({query:"",fragment:""}).toString() === output.with({query:"",fragment:""}).toString()) throw new Error("Output must not overwrite the BASIC source.");
  if (source.scheme !== "file" || output.scheme !== "file") return;
  let outputStat;
  try { outputStat = await stat(output.fsPath); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return; throw error; }
  const sourceStat = await stat(source.fsPath);
  if (sourceStat.dev === outputStat.dev && sourceStat.ino === outputStat.ino) throw new Error("Output aliases the BASIC source.");
}
export function registerCommands(documents: EditorDocuments, diagnostics: EditorDiagnostics): vscode.Disposable {
  const output = vscode.window.createOutputChannel("ZXCode");
  const run = async (build: boolean, sourceUri?: vscode.Uri, outputUri?: vscode.Uri): Promise<EditorCommandResult> => {
    output.show(true);
    try {
      const document = sourceUri === undefined ? vscode.window.activeTextEditor?.document : await vscode.workspace.openTextDocument(sourceUri);
      if (document === undefined || document.languageId !== LANGUAGE_ID || document.isClosed) throw new Error("Select a ZX Spectrum BASIC document to check or build.");
      const snapshot = documents.snapshot(document);
      diagnostics.refresh(document);
      output.appendLine(`${build ? "Build" : "Check"}: ${document.uri.toString()} (version ${document.version})`);
      let destination = outputUri;
      if (build && destination === undefined) {
        if (document.isUntitled) destination = await vscode.window.showSaveDialog({filters:{"Spectrum TAP":["tap"]},title:"Save ZXCode TAP"});
        else destination = document.uri.with({path:document.uri.path.replace(/\.[^/.]+$/, "") + ".tap",query:"",fragment:""});
        if (destination === undefined) return {kind:"error",message:"Build cancelled: no TAP destination selected."};
      }
      const built = build ? buildTap(snapshot.source, {filenameBytes:Uint8Array.from([90,88,67,79,68,69,32,32,32,32]),autostart:0x8000}) : undefined;
      const result = built ?? checkProgram(snapshot.source);
      for (const diagnostic of result.diagnostics) {
        const position = document.positionAt(diagnostic.range.start);
        output.appendLine(`${position.line + 1}:${position.character + 1}: ${diagnostic.severity} ${diagnostic.code}: ${diagnostic.message}`);
      }
      if (result.kind === "error") { const message = "BASIC compatibility check failed; see Problems and ZXCode Output."; output.appendLine(message); return {kind:"error",message}; }
      if (built?.kind === "success" && destination !== undefined) {
        await protectSource(document.uri, destination);
        if (document.isClosed || document.version !== snapshot.identity.version || document.getText() !== snapshot.source.text) throw new Error("Source changed during build; run Build again.");
        await vscode.workspace.fs.writeFile(destination, built.tap.tapBytes);
        const message = `Wrote ${destination.toString()}`;
        output.appendLine(message);
        return {kind:"success",output:destination,message};
      }
      const message = "BASIC compatibility check passed.";
      output.appendLine(message);
      return {kind:"success",message};
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      output.appendLine(`ZXCode: ${message}`);
      return {kind:"error",message};
    }
  };
  return vscode.Disposable.from(output,
    vscode.commands.registerCommand("zxcode.check", (source?: vscode.Uri) => run(false, source)),
    vscode.commands.registerCommand("zxcode.build", (source?: vscode.Uri, destination?: vscode.Uri) => run(true, source, destination))
  );
}
