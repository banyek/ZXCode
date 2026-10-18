import * as vscode from "vscode";
import { previewRenumber, applyRenumber } from "@zxcode/core";
import type { RenumberOptions, RenumberResult } from "@zxcode/core";
import type { EditorDocuments } from "./documents.js";
import { toEditorRange } from "./ranges.js";

/** Read-only diff followed by a separate explicit Apply command. */
export function registerRenumber(documents: EditorDocuments): vscode.Disposable {
  const contents = new Map<string,string>();
  let sequence = 0;
  let pending: {editor:vscode.TextEditor;result:RenumberResult} | undefined;
  const provider = vscode.workspace.registerTextDocumentContentProvider("zxcode-renumber",{provideTextDocumentContent:uri => contents.get(uri.toString()) ?? ""});
  const preview = vscode.commands.registerCommand("zxcode.previewRenumber",async (options?:RenumberOptions) => {
    const editor = vscode.window.activeTextEditor;
    if (editor?.document.languageId !== "zx-spectrum-basic") return;
    if (options === undefined) {
      const input = await vscode.window.showInputBox({title:"Renumber BASIC",prompt:"Start, step, first old line, last old line",value:"10,10,1,9999",validateInput:value => /^\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*\d+\s*$/.test(value) ? undefined : "Enter four comma-separated integers."});
      if (input === undefined) return;
      const [start,step,fromLine,throughLine] = input.split(",").map(Number);
      options = {start:start!,step:step!,fromLine:fromLine!,throughLine:throughLine!};
    }
    const snapshot = documents.snapshot(editor.document);
    const result = previewRenumber(snapshot,options);
    pending = undefined;
    contents.clear();
    if (result.value.kind === "blocked") {void vscode.window.showWarningMessage(result.value.issues.map(issue => issue.message).join(" ")); return result;}
    const id = ++sequence;
    const before = vscode.Uri.parse(`zxcode-renumber:/${id}/original.zxbas`), after = vscode.Uri.parse(`zxcode-renumber:/${id}/renumbered.zxbas`);
    contents.set(before.toString(),snapshot.source.text);contents.set(after.toString(),result.value.resultText);
    pending = {editor,result};
    await vscode.commands.executeCommand("vscode.diff",before,after,"ZXCode: Renumber Preview — use Apply Renumber to accept");
    return result;
  });
  const apply = vscode.commands.registerCommand("zxcode.applyRenumber",async () => {
    const plan = pending;
    if (plan === undefined) return false;
    pending = undefined;
    const document = plan.editor.document;
    if (document.isClosed || document.languageId !== "zx-spectrum-basic") return false;
    const editor = await vscode.window.showTextDocument(document);
    const snapshot = documents.snapshot(document);
    const result = applyRenumber(plan.result,snapshot);
    if (result.kind === "blocked") {void vscode.window.showWarningMessage(result.issues.map(issue => issue.message).join(" "));return false;}
    // TextEditor.edit binds one edit transaction to the document version. No await
    // occurs between this final snapshot guard and constructing the transaction.
    return editor.edit(builder => {
      for (const edit of result.edits) builder.replace(toEditorRange(document,snapshot,edit.range),edit.newText);
    });
  });
  return vscode.Disposable.from(preview,apply,provider,{dispose:()=>{pending=undefined;contents.clear();}});
}
