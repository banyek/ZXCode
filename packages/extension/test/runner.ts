import assert from "node:assert/strict";
import { join, relative, isAbsolute } from "node:path";
import * as vscode from "vscode";
import { readBasicTap, inspectBasicTap } from "@zxcode/core";
import { link, chmod } from "node:fs/promises";
import type { EditorRunResult } from "../src/run.js";
import type { EditorCommandResult } from "../src/commands.js";
import type { ZXCodeExtensionApi } from "../src/extension.js";
import { toEditorDiagnostic } from "../src/diagnostics.js";
async function waitFor(predicate: () => boolean | Promise<boolean>, message: string): Promise<void> {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  assert.ok(await predicate(), message);
}
/** Invoked by the real Extension Development Host; rejection fails the smoke run. */
export async function run(): Promise<void> {
  const extension = vscode.extensions.getExtension<ZXCodeExtensionApi>("banyek.zxcode-vscode");
  assert.ok(extension, "ZXCode is installed in the isolated host");
  if (process.env.ZXCODE_INSTALLED_ROOT) {
    const installedPath = relative(process.env.ZXCODE_INSTALLED_ROOT, extension.extensionPath);
    assert.ok(installedPath !== "" && !installedPath.startsWith("..") && !isAbsolute(installedPath), "Actual installed VSIX is loaded, not the checkout");
  }
  const testFiles = process.env.ZXCODE_TEST_FILES;
  assert.ok(testFiles, "Smoke files belong to the isolated test directory");
  const automaticUri = vscode.Uri.file(join(testFiles, "automatic.zxbas"));
  await vscode.workspace.fs.writeFile(automaticUri, Buffer.from("10 STOP\n"));
  const automatic = await vscode.workspace.openTextDocument(automaticUri);
  assert.equal(automatic.languageId, "zx-spectrum-basic");
  await vscode.window.showTextDocument(automatic);
  await waitFor(() => extension.isActive, "Language selection automatically activates ZXCode");
  const api = await extension.activate();
  if (process.env.ZXCODE_INSTALLED_ROOT) {
    const sample = await vscode.workspace.fs.readFile(vscode.Uri.joinPath(extension.extensionUri, "examples/getting-started.zxbas"));
    const sampleDocument = await vscode.workspace.openTextDocument({language:"zx-spectrum-basic",content:new TextDecoder().decode(sample)});
    assert.equal(api.queries.diagnostics(api.documents.snapshot(sampleDocument)).value.length, 0);
    const sampleTap = vscode.Uri.file(join(testFiles, "packaged-sample.tap"));
    assert.equal((await vscode.commands.executeCommand<EditorCommandResult>("zxcode.build", sampleDocument.uri, sampleTap))?.kind, "success");
    assert.equal(inspectBasicTap(await vscode.workspace.fs.readFile(sampleTap)).kind, "decoded");
  }
  const renumberDocument = await vscode.workspace.openTextDocument({language:"zx-spectrum-basic",content:'10 GO TO 20\n20 PRINT 10\n'});
  await vscode.window.showTextDocument(renumberDocument);
  const renumberPreview = await vscode.commands.executeCommand<{value:{kind:string;resultText:string}}>("zxcode.previewRenumber",{start:100,step:10});
  assert.equal(renumberPreview?.value.kind,"preview");
  assert.equal(renumberDocument.getText(),'10 GO TO 20\n20 PRINT 10\n',"Preview never changes source");
  assert.equal(await vscode.commands.executeCommand("zxcode.applyRenumber"),true);
  assert.equal(renumberDocument.getText(),'100 GO TO 110\n110 PRINT 10\n');
  await vscode.window.showTextDocument(renumberDocument);
  await vscode.commands.executeCommand("zxcode.previewRenumber",{start:200,step:10});
  const renumberEditor = await vscode.window.showTextDocument(renumberDocument);
  await renumberEditor.edit(builder=>builder.insert(new vscode.Position(1,12)," "));
  const editedRenumberText = renumberDocument.getText();
  assert.equal(await vscode.commands.executeCommand("zxcode.applyRenumber"),false,"Source edits invalidate a preview");
  assert.equal(renumberDocument.getText(),editedRenumberText);
  const formatDocument = await vscode.workspace.openTextDocument({language:"zx-spectrum-basic",content:'  0010  PRINT   "keep  spaces": REM  tail   \r\n'});
  const formatEdits = await vscode.commands.executeCommand<vscode.TextEdit[]>("vscode.executeFormatDocumentProvider",formatDocument.uri,{tabSize:4,insertSpaces:true});
  assert.ok(formatEdits && formatEdits.length > 0);
  const formatWorkspaceEdit = new vscode.WorkspaceEdit();formatWorkspaceEdit.set(formatDocument.uri,formatEdits);
  assert.equal(await vscode.workspace.applyEdit(formatWorkspaceEdit),true);
  assert.equal(formatDocument.getText(),'0010 PRINT "keep  spaces": REM  tail   \r\n');
  assert.deepEqual((await vscode.commands.executeCommand("vscode.executeFormatDocumentProvider",formatDocument.uri,{tabSize:4,insertSpaces:true})) ?? [],[]);
  const fixDocument = await vscode.workspace.openTextDocument({language:"zx-spectrum-basic",content:'10PRINT "£©↑"\r\n'});
  const fixActions = await vscode.commands.executeCommand<vscode.CodeAction[]>("vscode.executeCodeActionProvider",fixDocument.uri,new vscode.Range(0,0,0,7),vscode.CodeActionKind.QuickFix.value);
  const fixAction = fixActions?.find(action=>action.title === "Insert space after BASIC line number");
  assert.ok(fixAction?.edit,"Native quick fix exposes edits for preview");
  assert.ok(api.queries.diagnostics(api.documents.snapshot(fixDocument)).value.some(diagnostic=>diagnostic.code === "ZX1002"));
  assert.equal(fixDocument.getText(),'10PRINT "£©↑"\r\n');
  assert.equal(await vscode.workspace.applyEdit(fixAction.edit),true);
  assert.equal(fixDocument.getText(),'10 PRINT "£©↑"\r\n');
  assert.equal(api.queries.diagnostics(api.documents.snapshot(fixDocument)).value.length,0);
  const workspaceA = vscode.Uri.file(join(testFiles,"workspace-a.zxbas")), workspaceB = vscode.Uri.file(join(testFiles,"workspace-b.zxbas"));
  await vscode.workspace.fs.writeFile(workspaceA,Buffer.from('10 LET workspacecount=1\n20 GO TO 99\n'));
  await vscode.workspace.fs.writeFile(workspaceB,Buffer.from('99 LET workspacecount=2\n'));
  const ignoredBas = vscode.Uri.file(join(testFiles,"unopened.bas"));
  await vscode.workspace.fs.writeFile(ignoredBas,Buffer.from('10 LET genericworkspace=1\n'));
  let workspaceMatches:vscode.SymbolInformation[]=[];
  for(let attempt=0;attempt<20;attempt++) {
    workspaceMatches=(await vscode.commands.executeCommand<vscode.SymbolInformation[]>("vscode.executeWorkspaceSymbolProvider","workspacecount")) ?? [];
    if(workspaceMatches.filter(item=>[workspaceA.toString(),workspaceB.toString()].includes(item.location.uri.toString())).length === 2) break;
    await new Promise(resolve=>setTimeout(resolve,50));
  }
  assert.equal(workspaceMatches.filter(item=>[workspaceA.toString(),workspaceB.toString()].includes(item.location.uri.toString())).length,2);
  assert.ok(!vscode.workspace.textDocuments.some(document=>document.uri.toString() === workspaceA.toString()),"Workspace query does not open discovered disk files");
  assert.ok(!((await vscode.commands.executeCommand<vscode.SymbolInformation[]>("vscode.executeWorkspaceSymbolProvider","genericworkspace")) ?? []).some(item=>item.location.uri.toString() === ignoredBas.toString()),"Unopened generic .bas is not claimed");
  const dirtyWorkspace = await vscode.workspace.openTextDocument(workspaceA);
  const dirtyWorkspaceEditor = await vscode.window.showTextDocument(dirtyWorkspace);
  await dirtyWorkspaceEditor.edit(builder=>builder.replace(new vscode.Range(0,7,0,21),"dirtyworkspace"));
  assert.ok(dirtyWorkspace.isDirty,"Workspace fixture remains unsaved");
  assert.ok(dirtyWorkspace.getText().includes("dirtyworkspace"));
  // A queued file/editor event may invalidate a query during discovery. Require
  // the unsaved symbol from a stable query, rather than assuming no event races.
  await waitFor(async () => {
    const symbols=(await vscode.commands.executeCommand<vscode.SymbolInformation[]>("vscode.executeWorkspaceSymbolProvider","dirtyworkspace")) ?? [];
    return symbols.some(item=>item.location.uri.toString() === workspaceA.toString());
  },"Workspace navigation uses unsaved text after discovery events settle");
  assert.ok(api.queries.diagnostics(api.documents.snapshot(dirtyWorkspace)).value.some(diagnostic=>diagnostic.code === "ZX3001"),"Other files do not resolve missing local lines");
  const existingUri = vscode.Uri.file(join(testFiles,"existing.zxbas"));
  const existingDocument = await vscode.workspace.openTextDocument(existingUri);
  const existingText = existingDocument.getText();
  const fnCall = existingText.indexOf("FN f",existingText.indexOf("FN f")+1)+3;
  const existingDefinitions = await vscode.commands.executeCommand<vscode.Location[]>("vscode.executeDefinitionProvider",existingUri,existingDocument.positionAt(fnCall));
  assert.equal(existingDefinitions?.length,1);assert.equal(existingDefinitions[0]?.range.start.line,4);
  const existingReferences = await vscode.commands.executeCommand<vscode.Location[]>("vscode.executeReferenceProvider",existingUri,existingDocument.positionAt(fnCall));
  assert.ok(existingReferences && existingReferences.length >= 2);
  const existingOutline = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>("vscode.executeDocumentSymbolProvider",existingUri);
  assert.equal(existingOutline?.length,10);
  await vscode.window.showTextDocument(existingDocument);
  const existingPreview = await vscode.commands.executeCommand<{value:{kind:string;lines:readonly unknown[];references:readonly unknown[]}}>("zxcode.previewRenumber",{start:100,step:100});
  assert.equal(existingPreview?.value.kind,"preview");assert.equal(existingDocument.getText(),existingText);
  assert.equal(await vscode.commands.executeCommand("zxcode.applyRenumber"),true);
  assert.ok(existingDocument.getText().includes("RESTORE 200"));
  const existingFormatEdits = (await vscode.commands.executeCommand<vscode.TextEdit[]>("vscode.executeFormatDocumentProvider",existingUri,{tabSize:4,insertSpaces:true})) ?? [];
  const existingFormat = new vscode.WorkspaceEdit();existingFormat.set(existingUri,existingFormatEdits);
  assert.equal(await vscode.workspace.applyEdit(existingFormat),true);
  assert.deepEqual((await vscode.commands.executeCommand("vscode.executeFormatDocumentProvider",existingUri,{tabSize:4,insertSpaces:true})) ?? [],[]);
  const existingRebuilt = vscode.Uri.file(join(testFiles,"existing-transformed.tap"));
  assert.equal((await vscode.commands.executeCommand<EditorCommandResult>("zxcode.build",existingUri,existingRebuilt))?.kind,"success");
  assert.equal(api.queries.diagnostics(api.documents.snapshot(existingDocument)).value.length,0);
  if(process.env.ZXCODE_TEST_WORKFLOW_EVIDENCE) {
    const destination = vscode.Uri.file(process.env.ZXCODE_TEST_WORKFLOW_EVIDENCE);
    for(const name of ["existing-original.tap","existing-preserved.tap","existing.zxbas","existing.zxbas.import.json","existing-transformed.tap"]) await vscode.workspace.fs.writeFile(vscode.Uri.joinPath(destination,name),await vscode.workspace.fs.readFile(vscode.Uri.file(join(testFiles,name))));
    await vscode.workspace.fs.writeFile(vscode.Uri.joinPath(destination,"existing-transformed.zxbas"),Buffer.from(existingDocument.getText()));
    await vscode.workspace.fs.writeFile(vscode.Uri.joinPath(destination,"native-workflow.json"),Buffer.from(JSON.stringify({schemaVersion:1,installedExtension:extension.extensionPath,definitions:existingDefinitions?.length,references:existingReferences.length,outlineLines:existingOutline?.length,renumber:existingPreview?.value,formatEditCount:existingFormatEdits.length,remainingDiagnostics:0},null,2)+"\n"));
  }
  if(process.env.ZXCODE_TEST_ZESARUX) {
    type DebugMessage={type:string;event?:string;command?:string;success?:boolean;body?:{breakpoints?:{verified:boolean;line:number;column?:number}[]}};
    const messages:DebugMessage[]=[];
    const tracker=vscode.debug.registerDebugAdapterTrackerFactory("zxcode-basic",{createDebugAdapterTracker:()=>({onDidSendMessage:message=>messages.push(message as DebugMessage)})});
    const debugUri=vscode.Uri.file(join(testFiles,"debug-runtime.zxbas"));
    let started:vscode.DebugSession | undefined;
    const breakpoint=new vscode.SourceBreakpoint(new vscode.Location(debugUri,new vscode.Position(1,15)));
    try {
      await vscode.workspace.openTextDocument(debugUri);
      assert.equal(await vscode.debug.startDebugging(vscode.workspace.getWorkspaceFolder(debugUri),{type:"zxcode-basic",request:"launch",name:"ZXCode actual BASIC breakpoint smoke",program:debugUri.fsPath,zesaruxExecutable:process.env.ZXCODE_TEST_ZESARUX,stopOnEntry:true}),true);
      await waitFor(()=>messages.some(message=>message.event==="stopped"),"Actual debugger reaches verified BASIC entry");
      started=vscode.debug.activeDebugSession;assert.ok(started);
      const entry=await started.customRequest("stackTrace",{threadId:1}) as {stackFrames:{name:string;line:number;column:number}[]};
      assert.equal(entry.stackFrames[0]?.name,"BASIC 10:1");assert.equal(entry.stackFrames[0]?.line,1);
      vscode.debug.addBreakpoints([breakpoint]);
      await waitFor(()=>messages.some(message=>message.command==="setBreakpoints"&&message.success&&message.body?.breakpoints?.some(item=>item.verified&&item.line===2&&item.column===16)),"Native statement breakpoint is verified");
      const before=messages.filter(message=>message.event==="stopped").length;
      await started.customRequest("continue",{threadId:1});
      await waitFor(()=>messages.filter(message=>message.event==="stopped").length>before,"Actual debugger hits IF-tail GO SUB source breakpoint");
      const statement=await started.customRequest("stackTrace",{threadId:1}) as {stackFrames:{name:string;line:number;column:number}[]};
      assert.equal(statement.stackFrames[0]?.name,"BASIC 20:2");assert.equal(statement.stackFrames[0]?.line,2);assert.equal(statement.stackFrames[0]?.column,16);
      const stepped:string[]=[];
      for(const expected of ["BASIC 100:1","BASIC 100:2","BASIC 20:3"]) {
        const count=messages.filter(message=>message.event==="stopped").length;
        await started.customRequest("stepIn",{threadId:1,granularity:"statement"});
        await waitFor(()=>messages.filter(message=>message.event==="stopped").length>count,"Native BASIC Step Into reaches the next dispatch");
        const frame=await started.customRequest("stackTrace",{threadId:1}) as {stackFrames:{name:string}[]};assert.equal(frame.stackFrames[0]?.name,expected);stepped.push(expected);
      }
      await assert.rejects(Promise.resolve(started.customRequest("next",{threadId:1})));
      const document=await vscode.workspace.openTextDocument(debugUri),editor=await vscode.window.showTextDocument(document);
      await editor.edit(builder=>builder.insert(new vscode.Position(0,0)," "));
      await waitFor(()=>messages.some(message=>message.event==="terminated"),"Source edits terminate the stale debug binding");
      if(process.env.ZXCODE_TEST_DEBUG_EVIDENCE) await vscode.workspace.fs.writeFile(vscode.Uri.joinPath(vscode.Uri.file(process.env.ZXCODE_TEST_DEBUG_EVIDENCE),"native-basic-debug.json"),Buffer.from(JSON.stringify({schemaVersion:1,entry:entry.stackFrames,statement:statement.stackFrames,nativeStatementBreakpointVerified:true,stepped,sourceEditTerminated:true},null,2)+"\n"));
    } finally {vscode.debug.removeBreakpoints([breakpoint]);if(started)await vscode.debug.stopDebugging(started);tracker.dispose();}
    const variablesUri=vscode.Uri.file(join(testFiles,"debug-variables.zxbas"));
    const variablesBreakpoint=new vscode.SourceBreakpoint(new vscode.Location(variablesUri,new vscode.Position(6,3)));
    const variableEvents:string[]=[];const variableTracker=vscode.debug.registerDebugAdapterTrackerFactory("zxcode-basic",{createDebugAdapterTracker:()=>({onDidSendMessage:message=>{const event=(message as DebugMessage).event;if(event)variableEvents.push(event);}})});
    let variableSession:vscode.DebugSession | undefined;
    try {
      vscode.debug.addBreakpoints([variablesBreakpoint]);
      assert.equal(await vscode.debug.startDebugging(vscode.workspace.getWorkspaceFolder(variablesUri),{type:"zxcode-basic",request:"launch",name:"ZXCode runtime variable smoke",program:variablesUri.fsPath,zesaruxExecutable:process.env.ZXCODE_TEST_ZESARUX,stopOnEntry:false}),true);
      await waitFor(()=>variableEvents.includes("stopped"),"Actual variable fixture pauses before STOP");variableSession=vscode.debug.activeDebugSession;assert.ok(variableSession);
      const scopes=await variableSession.customRequest("scopes",{frameId:1}) as {scopes:{name:string;variablesReference:number}[]};assert.equal(scopes.scopes[0]?.name,"48K BASIC variables");
      type NativeVariable={name:string;value:string;type:string;variablesReference:number;memoryReference?:string};
      const roots=await variableSession.customRequest("variables",{variablesReference:scopes.scopes[0]!.variablesReference}) as {variables:NativeVariable[]};
      const find=(name:string):NativeVariable=>{const value=roots.variables.find(item=>item.name===name);assert.ok(value);return value;};
      assert.equal(find("a").value,"123");assert.equal(find("longname").value,"-456");assert.equal(find("s$").value,'"hi\\x0D\\xFF"');assert.equal(find("e$").value,'""');assert.equal(find("i").value,"1");
      const romNumeric=JSON.parse(new TextDecoder().decode(await vscode.workspace.fs.readFile(vscode.Uri.file(join(testFiles,"rom-numeric-reference.json"))))) as Record<string,string>;
      assert.equal(romNumeric[".5"],"7f7fffffff");assert.equal(romNumeric["0.1"],"7d4ccccccc");
      // Original-ROM DEC-TO-FP, independently pinned in numeric-rom.json, stores
      // .5 one value below exact 1/2. zmakebas's variable-layout reference uses
      // a different hidden value; neither reference nor compiler bytes change.
      assert.equal(find("f").value,String(3435973836/34359738368));
      const array=await variableSession.customRequest("variables",{variablesReference:find("n").variablesReference,start:1,count:2,filter:"indexed"}) as {variables:NativeVariable[]};
      assert.deepEqual(array.variables.map(item=>[item.name,item.value]),[["(1,2)","-2"],["(2,1)",String(0.5-2**-33)]]);
      for(const [expression,expected] of [["a","123"],["LONG NAME","-456"],["n(2,1)",String(0.5-2**-33)],["i","1"]]) {
        const watch=await variableSession.customRequest("evaluate",{expression,context:"watch",frameId:1}) as {result:string};assert.equal(watch.result,expected);
      }
      await assert.rejects(Promise.resolve(variableSession.customRequest("evaluate",{expression:"RND",context:"watch"})));
      await assert.rejects(Promise.resolve(variableSession.customRequest("evaluate",{expression:"n(3,1)",context:"watch"})));
      const screen=await vscode.commands.executeCommand<vscode.WebviewPanel>("zxcode.showScreen");assert.ok(screen);assert.equal(screen.title,"Spectrum Screen");screen.dispose();
      const raw=await variableSession.customRequest("readMemory",{memoryReference:find("a").memoryReference,count:5}) as {data:string};assert.deepEqual(Array.from(Buffer.from(raw.data,"base64")),[0,0,123,0,0]);
      const memoryUri=await vscode.commands.executeCommand<vscode.Uri>("zxcode.viewMemory",0x5c4b,16);assert.ok(memoryUri);assert.equal(memoryUri.scheme,"zxcode-memory");const dump=await vscode.workspace.openTextDocument(memoryUri);assert.ok(dump.getText().includes("5C4B:"));assert.ok(dump.getText().includes("historical after execution resumes"));
      const oldSessionId=variableSession.id,stopCount=variableEvents.filter(event=>event==="stopped").length;
      assert.equal(await vscode.commands.executeCommand("zxcode.resetDebug"),true);
      await waitFor(()=>vscode.debug.activeDebugSession?.id!==oldSessionId&&variableEvents.filter(event=>event==="stopped").length>stopCount,"Cold reset reaches entry in a fresh native debug session");
      variableSession=vscode.debug.activeDebugSession;assert.ok(variableSession);assert.notEqual(variableSession.id,oldSessionId);
      const resetFrame=await variableSession.customRequest("stackTrace",{threadId:1}) as {stackFrames:{name:string}[]};assert.equal(resetFrame.stackFrames[0]?.name,"BASIC 10:1");
      const resetScopes=await variableSession.customRequest("scopes",{frameId:1}) as {scopes:{variablesReference:number}[]};
      const resetVariables=await variableSession.customRequest("variables",{variablesReference:resetScopes.scopes[0]!.variablesReference}) as {variables:unknown[]};assert.equal(resetVariables.variables.length,0);
      if(process.env.ZXCODE_TEST_DEBUG_EVIDENCE) await vscode.workspace.fs.writeFile(vscode.Uri.joinPath(vscode.Uri.file(process.env.ZXCODE_TEST_DEBUG_EVIDENCE),"native-basic-variables.json"),Buffer.from(JSON.stringify({schemaVersion:1,variables:roots.variables.map(item=>({name:item.name,value:item.value,type:item.type})),arrayPage:array.variables.map(item=>({name:item.name,value:item.value})),rawNumericBytes:Array.from(Buffer.from(raw.data,"base64")),readonlyMemorySnapshot:true,coldResetNewSession:true,resetEntry:resetFrame.stackFrames,resetVariableCount:resetVariables.variables.length},null,2)+"\n"));
    } finally {vscode.debug.removeBreakpoints([variablesBreakpoint]);if(variableSession)await vscode.debug.stopDebugging(variableSession);variableTracker.dispose();}
  }
  const genericUri = vscode.Uri.file(join(testFiles, "generic.bas"));
  await vscode.workspace.fs.writeFile(genericUri, Buffer.from("10 STOP\n"));
  const generic = await vscode.workspace.openTextDocument(genericUri);
  assert.notEqual(generic.languageId, "zx-spectrum-basic", "Generic .bas is not claimed globally");
  const selected = await vscode.languages.setTextDocumentLanguage(generic, "zx-spectrum-basic");
  assert.equal(selected.languageId, "zx-spectrum-basic");
  const document = await vscode.workspace.openTextDocument({ language: "plaintext", content: '10 REM £©↑\r\n20 GO TO 100\r\n100 PRINT "hello"\r\n' });
  const snapshot = api.documents.snapshot(document);
  assert.strictEqual(api.documents.snapshot(document), snapshot);
  assert.equal(api.queries.diagnostics(snapshot).value.length, 0);
  const offset = document.getText().indexOf("100");
  const definitions = api.queries.definitions(snapshot, offset).value;
  assert.equal(definitions.length, 1);
  const editorRange = api.toEditorRange(document, snapshot, definitions[0]!);
  assert.equal(document.getText(editorRange), "100");
  assert.equal(editorRange.start.line, 2);
  assert.equal(editorRange.start.character, 0);
  const glyph = snapshot.source.text.indexOf("£");
  assert.equal(document.getText(api.toEditorRange(document, snapshot, snapshot.source.range(glyph, glyph + 3))), "£©↑");
  for (const [severity, expected] of [["error", vscode.DiagnosticSeverity.Error], ["warning", vscode.DiagnosticSeverity.Warning], ["information", vscode.DiagnosticSeverity.Information], ["hint", vscode.DiagnosticSeverity.Hint]] as const) {
    const converted = toEditorDiagnostic(document, snapshot, {code:"ZX9001",severity,category:"tooling",message:"Shared message",range:snapshot.source.range(glyph,glyph+3),related:[{message:"Related",range:snapshot.source.range(0,2)}]});
    assert.equal(converted.severity, expected);
    assert.equal(converted.code, "ZX9001");
    assert.equal(converted.source, "ZXCode");
    assert.equal(converted.message, "Shared message");
    assert.equal(document.getText(converted.range), "£©↑");
    assert.equal(converted.relatedInformation?.[0]?.location.uri.toString(), document.uri.toString());
    assert.equal(document.getText(converted.relatedInformation![0]!.location.range), "10");
  }
  assert.ok(document.getText().includes("\r\n"));
  const unicodeEdit = new vscode.WorkspaceEdit();
  unicodeEdit.insert(document.uri, document.positionAt(glyph + 3), "😀");
  assert.equal(await vscode.workspace.applyEdit(unicodeEdit), true);
  const unicodeSnapshot = api.documents.snapshot(document);
  const unsupported = api.queries.diagnostics(unicodeSnapshot).value.find((diagnostic) => diagnostic.code === "ZX2001");
  assert.ok(unsupported);
  assert.equal(unsupported.range.end - unsupported.range.start, 2);
  assert.equal(document.getText(api.toEditorRange(document, unicodeSnapshot, unsupported.range)), "😀");
  const edit = new vscode.WorkspaceEdit();
  edit.replace(document.uri, new vscode.Range(document.positionAt(0), document.positionAt(document.getText().length)), "10 PRINT AT 10,");
  assert.equal(await vscode.workspace.applyEdit(edit), true);
  const next = api.documents.snapshot(document);
  assert.notStrictEqual(next.identity, snapshot.identity);
  assert.ok(next.identity.version > snapshot.identity.version);
  assert.ok(api.queries.diagnostics(next).value.some((diagnostic) => diagnostic.code === "ZX1101"));
  assert.throws(() => api.toEditorRange(document, snapshot, definitions[0]!), /stale/);
  assert.equal(api.queries.diagnostics(snapshot).value.length, 0);
  api.documents.close(document);
  assert.notStrictEqual(api.documents.snapshot(document).identity, next.identity);
  assert.equal(vscode.languages.getDiagnostics(document.uri).length, 0, "Plaintext is not automatically diagnosed");
  const problemsUri = vscode.Uri.file(join(testFiles, "problems.zxbas"));
  await vscode.workspace.fs.writeFile(problemsUri, Buffer.from("10 PRINT AT 10,"));
  const problems = await vscode.workspace.openTextDocument(problemsUri);
  await waitFor(() => vscode.languages.getDiagnostics(problemsUri).some((diagnostic) => diagnostic.code === "ZX1101"), "Malformed BASIC appears in Problems");
  const visible = vscode.languages.getDiagnostics(problemsUri).find((diagnostic) => diagnostic.code === "ZX1101")!;
  assert.equal(visible.severity, vscode.DiagnosticSeverity.Error);
  assert.equal(visible.source, "ZXCode");
  const checkedProblems = api.documents.snapshot(problems);
  const coreProblem = api.queries.diagnostics(checkedProblems).value.find((diagnostic) => diagnostic.code === "ZX1101")!;
  assert.ok(visible.range.isEqual(api.toEditorRange(problems, checkedProblems, coreProblem.range)));
  const validEdit = new vscode.WorkspaceEdit();
  validEdit.replace(problemsUri, new vscode.Range(problems.positionAt(0), problems.positionAt(problems.getText().length)), "10 STOP");
  assert.equal(await vscode.workspace.applyEdit(validEdit), true);
  await waitFor(() => vscode.languages.getDiagnostics(problemsUri).length === 0, "Valid edits clear stale Problems");
  const warningEdit = new vscode.WorkspaceEdit();
  warningEdit.replace(problemsUri, new vscode.Range(problems.positionAt(0), problems.positionAt(problems.getText().length)), "10 GO TO 999");
  assert.equal(await vscode.workspace.applyEdit(warningEdit), true);
  await waitFor(() => vscode.languages.getDiagnostics(problemsUri).some((diagnostic) => diagnostic.code === "ZX3001"), "Semantic warnings appear after edits");
  assert.equal(vscode.languages.getDiagnostics(problemsUri).find((diagnostic) => diagnostic.code === "ZX3001")!.severity, vscode.DiagnosticSeverity.Warning);
  await vscode.languages.setTextDocumentLanguage(problems, "plaintext");
  await waitFor(() => vscode.languages.getDiagnostics(problemsUri).length === 0, "Changing language closes owned Problems");
  const completionUri = vscode.Uri.file(join(testFiles, "completion.zxbas"));
  await vscode.workspace.fs.writeFile(completionUri, Buffer.from("10 PR"));
  const completionDocument = await vscode.workspace.openTextDocument(completionUri);
  const completionEditor = await vscode.window.showTextDocument(completionDocument);
  completionEditor.selection = new vscode.Selection(0, 5, 0, 5);
  const suggestions = await vscode.commands.executeCommand<vscode.CompletionList>("vscode.executeCompletionItemProvider", completionUri, new vscode.Position(0, 5));
  const print = suggestions?.items.find((item) => item.label === "PRINT");
  assert.ok(print, "Shared command completion is registered");
  assert.equal(print.insertText, "PRINT");
  assert.ok(print.documentation instanceof vscode.MarkdownString);
  assert.equal(print.documentation.isTrusted, false);
  assert.ok(print.range instanceof vscode.Range);
  assert.equal(completionDocument.getText(print.range), "PR");
  await vscode.commands.executeCommand("workbench.action.focusActiveEditorGroup");
  await vscode.commands.executeCommand("editor.action.triggerSuggest");
  await vscode.commands.executeCommand("workbench.action.closeAuxiliaryBar");
  await vscode.commands.executeCommand("workbench.action.closeSidebar");
  await vscode.commands.executeCommand("workbench.action.focusFirstEditorGroup");
  await vscode.commands.executeCommand("type", {text: "I"});
  await waitFor(() => completionDocument.getText() === "10 PRI", "Typing targets the completion editor");
  const acceptanceDeadline = Date.now() + 10000;
  while (completionDocument.getText() === "10 PRI" && Date.now() < acceptanceDeadline) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    await vscode.commands.executeCommand("editor.action.triggerSuggest");
    await new Promise((resolve) => setTimeout(resolve, 200));
    await vscode.commands.executeCommand("selectNextSuggestion");
    await vscode.commands.executeCommand("acceptSelectedSuggestion");
  }
  assert.equal(completionDocument.getText(), "10 PRINT", "Normal suggestion acceptance replaces the shared prefix");
  for (const [text, included, excluded] of [["10 LET a$=", "CHR$", "SIN"], ["10 REM PR", undefined, "PRINT"], ['10 PRINT "PR', undefined, "PRINT"]] as const) {
    const change = new vscode.WorkspaceEdit();
    change.replace(completionUri, new vscode.Range(completionDocument.positionAt(0), completionDocument.positionAt(completionDocument.getText().length)), text);
    assert.equal(await vscode.workspace.applyEdit(change), true);
    const list = await vscode.commands.executeCommand<vscode.CompletionList>("vscode.executeCompletionItemProvider", completionUri, completionDocument.positionAt(text.length));
    if (included !== undefined) assert.ok(list?.items.some((item) => item.label === included), included);
    assert.ok(!list?.items.some((item) => item.label === excluded), excluded);
  }
  const navigationUri = vscode.Uri.file(join(testFiles, "navigation.zxbas"));
  const navigationText = "10 LET a=1\r\n20 DEF FN f(x)=x+a\r\n30 PRINT FN f(a)\r\n40 GO TO 10\r\n50 DIM b(2)";
  await vscode.workspace.fs.writeFile(navigationUri, Buffer.from(navigationText));
  const navigationDocument = await vscode.workspace.openTextDocument(navigationUri);
  const navigationSnapshot = api.documents.snapshot(navigationDocument);
  for (const offset of [navigationText.lastIndexOf("10"), navigationText.indexOf("f(a)"), navigationText.indexOf("a)")]) {
    const native = await vscode.commands.executeCommand<vscode.Location[]>("vscode.executeDefinitionProvider", navigationUri, navigationDocument.positionAt(offset));
    const expected = api.queries.definitions(navigationSnapshot, offset).value;
    assert.ok(expected.length > 0);
    assert.equal(native?.length, expected.length);
    for (const range of expected) assert.ok(native?.some((location) => location.uri.toString() === navigationUri.toString() && location.range.isEqual(api.toEditorRange(navigationDocument, navigationSnapshot, range))));
    const references = await vscode.commands.executeCommand<vscode.Location[]>("vscode.executeReferenceProvider", navigationUri, navigationDocument.positionAt(offset));
    const expectedReferences = api.queries.references(navigationSnapshot, offset, {includeDeclaration: true}).value;
    assert.equal(references?.length, expectedReferences.length);
    for (const range of expectedReferences) assert.ok(references?.some((location) => location.range.isEqual(api.toEditorRange(navigationDocument, navigationSnapshot, range))));
  }
  const helpOffset = navigationText.indexOf("PRINT");
  const hovers = await vscode.commands.executeCommand<vscode.Hover[]>("vscode.executeHoverProvider", navigationUri, navigationDocument.positionAt(helpOffset));
  const expectedHover = api.queries.hover(navigationSnapshot, helpOffset).value;
  assert.ok(expectedHover);
  assert.ok(hovers?.some((hover) => hover.range?.isEqual(api.toEditorRange(navigationDocument, navigationSnapshot, expectedHover.range)) && hover.contents.some((content) => typeof content === "object" && "value" in content && content.value.includes(new vscode.MarkdownString().appendText(expectedHover.documentation.summary).value))));
  const outline = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>("vscode.executeDocumentSymbolProvider", navigationUri);
  const expectedOutline = api.queries.symbols(navigationSnapshot).value;
  assert.equal(outline?.length, expectedOutline.length);
  const checkSymbols = (actual: readonly vscode.DocumentSymbol[], expected: typeof expectedOutline): void => {
    assert.equal(actual.length, expected.length);
    for (let index = 0; index < expected.length; index++) {
      const left = actual[index]!;
      const right = expected[index]!;
      assert.equal(left.name, right.name);
      assert.ok(left.range.isEqual(api.toEditorRange(navigationDocument, navigationSnapshot, right.range)));
      assert.ok(left.selectionRange.isEqual(api.toEditorRange(navigationDocument, navigationSnapshot, right.selectionRange)));
      checkSymbols(left.children, right.children ?? []);
    }
  };
  checkSymbols(outline!, expectedOutline);
  assert.ok(outline?.some((symbol) => symbol.children.length > 0));
  await vscode.window.showTextDocument(navigationDocument);
  const checked = await vscode.commands.executeCommand<EditorCommandResult>("zxcode.check");
  assert.equal(checked?.kind, "success");
  const built = await vscode.commands.executeCommand<EditorCommandResult>("zxcode.build", navigationUri);
  assert.equal(built?.kind, "success");
  assert.ok(built?.output);
  assert.ok(built.message.includes(built.output.toString()));
  const originalTap = await vscode.workspace.fs.readFile(built.output);
  const framed = readBasicTap(originalTap);
  assert.equal(framed.kind, "success");
  const inspected = inspectBasicTap(originalTap);
  assert.equal(inspected.kind, "decoded");
  assert.ok(framed.kind === "success");
  assert.equal(framed.autostartEnabled, false);
  assert.equal(new TextDecoder().decode(framed.metadata.filenameBytes), "ZXCODE    ");
  const overwritten = await vscode.commands.executeCommand<EditorCommandResult>("zxcode.build", navigationUri, navigationUri);
  assert.equal(overwritten?.kind, "error");
  assert.ok(overwritten.message.includes("overwrite"));
  const aliasUri = vscode.Uri.file(join(testFiles, "source-alias.tap"));
  await link(navigationUri.fsPath, aliasUri.fsPath);
  const aliased = await vscode.commands.executeCommand<EditorCommandResult>("zxcode.build", navigationUri, aliasUri);
  assert.equal(aliased?.kind, "error");
  assert.ok(aliased.message.includes("aliases"));
  const brokenBuild = new vscode.WorkspaceEdit();
  brokenBuild.replace(navigationUri, new vscode.Range(navigationDocument.positionAt(0), navigationDocument.positionAt(navigationDocument.getText().length)), "10 PRINT AT 10,");
  assert.equal(await vscode.workspace.applyEdit(brokenBuild), true);
  assert.equal((await vscode.commands.executeCommand<EditorCommandResult>("zxcode.check", navigationUri))?.kind, "error");
  assert.equal((await vscode.commands.executeCommand<EditorCommandResult>("zxcode.build", navigationUri))?.kind, "error");
  assert.deepEqual(await vscode.workspace.fs.readFile(built.output), originalTap, "Failed build preserves the previous TAP");
  const dirty = new vscode.WorkspaceEdit();
  dirty.replace(navigationUri, new vscode.Range(navigationDocument.positionAt(0), navigationDocument.positionAt(navigationDocument.getText().length)), "10 STOP");
  assert.equal(await vscode.workspace.applyEdit(dirty), true);
  assert.equal(navigationDocument.isDirty, true);
  const dirtyOutput = vscode.Uri.file(join(testFiles, "dirty.tap"));
  assert.equal((await vscode.commands.executeCommand<EditorCommandResult>("zxcode.build", navigationUri, dirtyOutput))?.kind, "success");
  assert.notDeepEqual(await vscode.workspace.fs.readFile(dirtyOutput), originalTap, "Build uses unsaved text");
  assert.equal((await vscode.commands.executeCommand<EditorCommandResult>("zxcode.check", document.uri))?.kind, "error", "Plaintext is rejected");
  const configuration = vscode.workspace.getConfiguration("zxcode", navigationUri);
  try {
    await configuration.update("build.outputDirectory", "artifacts/tapes", vscode.ConfigurationTarget.Workspace);
    const configuredBuild = await vscode.commands.executeCommand<EditorCommandResult>("zxcode.build", navigationUri);
    assert.equal(configuredBuild?.kind, "success");
    assert.ok(configuredBuild?.output);
    assert.ok(configuredBuild.output.path.endsWith("/artifacts/tapes/navigation.tap"));
    assert.equal(readBasicTap(await vscode.workspace.fs.readFile(configuredBuild.output)).kind, "success");
    await configuration.update("build.outputDirectory", "../outside", vscode.ConfigurationTarget.Workspace);
    const invalidDirectory = await vscode.commands.executeCommand<EditorCommandResult>("zxcode.build", navigationUri);
    assert.equal(invalidDirectory?.kind, "error");
    assert.ok(invalidDirectory.message.includes("relative subdirectory"));
    await configuration.update("build.outputDirectory", "", vscode.ConfigurationTarget.Workspace);
    await configuration.update("target.profile", "unsupported", vscode.ConfigurationTarget.Workspace);
    const invalidProfile = await vscode.commands.executeCommand<EditorCommandResult>("zxcode.check", navigationUri);
    assert.equal(invalidProfile?.kind, "error");
    assert.ok(invalidProfile.message.includes("spectrum-48k"));
  } finally {
    await configuration.update("build.outputDirectory", undefined, vscode.ConfigurationTarget.Workspace);
    await configuration.update("target.profile", undefined, vscode.ConfigurationTarget.Workspace);
  }
  if (process.platform !== "win32" || process.env.ZXCODE_TEST_FUSE) {
    const currentRun = (): ZXCodeExtensionApi["runner"]["active"] => api.runner.active;
    const currentBuild = (): ZXCodeExtensionApi["runner"]["currentBuild"] => api.runner.currentBuild;
    let runUri = navigationUri;
    let runDocument = navigationDocument;
    if (process.env.ZXCODE_TEST_FUSE && process.env.ZXCODE_INSTALLED_ROOT) {
      runUri = vscode.Uri.file(join(testFiles, "getting-started.zxbas"));
      const sample = await vscode.workspace.fs.readFile(vscode.Uri.joinPath(extension.extensionUri, "examples/getting-started.zxbas"));
      await vscode.workspace.fs.writeFile(runUri, sample);
      runDocument = await vscode.workspace.openTextDocument(runUri);
      assert.equal(runDocument.languageId, "zx-spectrum-basic");
    }
    const emulatorSettings = vscode.workspace.getConfiguration("zxcode", runUri);
    const fakeUri = vscode.Uri.file(join(testFiles, "fuse-fixture.cjs"));
    await vscode.workspace.fs.writeFile(fakeUri, Buffer.from("#!/usr/bin/env node\nif(process.argv.includes('--version')) console.log('The Free Unix Spectrum Emulator (Fuse) version 1.10.0.'); else {process.on('SIGTERM',()=>process.exit(0));setInterval(()=>{},1000);}"));
    if (process.platform !== "win32") await chmod(fakeUri.fsPath, 0o755);
    try {
      await emulatorSettings.update("emulator.executable", process.env.ZXCODE_TEST_FUSE ?? fakeUri.fsPath, vscode.ConfigurationTarget.Workspace);
      await vscode.window.showTextDocument(runDocument);
      const run = await vscode.commands.executeCommand<EditorRunResult>("zxcode.run");
      assert.equal(run?.kind, "success", run?.message);
      const firstRun = api.runner.active;
      assert.ok(firstRun);
      const firstBuild = currentBuild();
      assert.ok(firstBuild);
      assert.equal(firstBuild.buildId, firstRun.buildId);
      assert.equal(firstBuild.sourceVersion, firstRun.version);
      assert.equal(firstBuild.source.text, runDocument.getText());
      assert.ok(firstBuild.source.textInRange(firstBuild.sourceMap[0]!.sourceRange).length > 0);
      const sidecar = JSON.parse(new TextDecoder().decode(await vscode.workspace.fs.readFile(vscode.Uri.file(firstRun.metadataPath)))) as {buildId:string};
      assert.equal(sidecar.buildId, firstRun.buildId);
      const runTap = readBasicTap(await vscode.workspace.fs.readFile(vscode.Uri.file(firstRun.session.artifact.path)));
      assert.equal(runTap.kind, "success");
      assert.equal(runTap.autostartLine, 10);
      if (process.env.ZXCODE_TEST_FUSE && process.env.ZXCODE_TEST_EVIDENCE) {
        const evidence = vscode.Uri.file(process.env.ZXCODE_TEST_EVIDENCE);
        await vscode.workspace.fs.createDirectory(evidence);
        await vscode.workspace.fs.writeFile(vscode.Uri.joinPath(evidence, "native-run.tap"), await vscode.workspace.fs.readFile(vscode.Uri.file(firstRun.session.artifact.path)));
        await vscode.workspace.fs.writeFile(vscode.Uri.joinPath(evidence, "native-build.json"), await vscode.workspace.fs.readFile(vscode.Uri.file(firstRun.metadataPath)));
        await vscode.workspace.fs.writeFile(vscode.Uri.joinPath(evidence, "native-session.json"), Buffer.from(JSON.stringify({schemaVersion:1,buildId:firstRun.buildId,version:firstRun.version,sourceId:firstRun.sourceId,backendId:firstRun.session.backendId,emulator:process.env.ZXCODE_TEST_FUSE,installedExtension:extension.extensionPath},null,2)));
        const hold = Number(process.env.ZXCODE_TEST_RUN_HOLD_MS ?? "10000");
        assert.ok(Number.isSafeInteger(hold) && hold >= 1000 && hold <= 30000);
        console.log("ZXCODE_NATIVE_SAMPLE_READY: inspect the Fuse window during the bounded hold");
        await new Promise((resolve) => setTimeout(resolve, hold));
        assert.equal(firstRun.session.state, "running");
      }
      const repeated = await vscode.commands.executeCommand<EditorRunResult>("zxcode.run", runUri);
      assert.equal(repeated?.kind, "success", repeated?.message);
      const secondRun = api.runner.active;
      assert.ok(secondRun);
      assert.notEqual(secondRun.session.artifact.path, firstRun.session.artifact.path);
      assert.equal(secondRun.buildId, firstRun.buildId);
      assert.equal(api.runner.buildForSession(firstRun.session.id), undefined);
      assert.strictEqual(api.runner.buildForSession(secondRun.session.id), secondRun.metadata);
      assert.equal((await firstRun.session.finished).state, "stopped");
      await assert.rejects(Promise.resolve(vscode.workspace.fs.stat(vscode.Uri.file(firstRun.session.artifact.path))));
      const malformedRun = new vscode.WorkspaceEdit();
      malformedRun.replace(runUri, new vscode.Range(runDocument.positionAt(0), runDocument.positionAt(runDocument.getText().length)), "10 PRINT AT 10,");
      assert.equal(await vscode.workspace.applyEdit(malformedRun), true);
      await waitFor(() => currentBuild() === undefined, "Editing invalidates current mapping before another Run");
      assert.equal((await vscode.commands.executeCommand<EditorRunResult>("zxcode.run", runUri))?.kind, "build-error");
      assert.strictEqual(api.runner.active, secondRun, "Invalid source does not replace the running emulator");
      assert.equal((await vscode.commands.executeCommand<EditorRunResult>("zxcode.stop"))?.kind, "success");
      assert.equal(api.runner.active, undefined);
      await assert.rejects(Promise.resolve(vscode.workspace.fs.stat(vscode.Uri.file(secondRun.session.artifact.path))));
      const repaired = new vscode.WorkspaceEdit();
      repaired.replace(runUri, new vscode.Range(runDocument.positionAt(0), runDocument.positionAt(runDocument.getText().length)), "10 STOP");
      assert.equal(await vscode.workspace.applyEdit(repaired), true);
      await emulatorSettings.update("emulator.executable", join(testFiles, "missing-fuse"), vscode.ConfigurationTarget.Workspace);
      const missingEmulator = await vscode.commands.executeCommand<EditorRunResult>("zxcode.run", runUri);
      assert.equal(missingEmulator?.kind, "error");
      assert.equal(missingEmulator.code, "not-found");
      assert.match(missingEmulator.message, /not found/);
      await emulatorSettings.update("emulator.executable", process.env.ZXCODE_TEST_FUSE ?? fakeUri.fsPath, vscode.ConfigurationTarget.Workspace);
      assert.equal((await vscode.commands.executeCommand<EditorRunResult>("zxcode.run", runUri))?.kind, "success");
      const shutdownRun = currentRun();
      assert.ok(shutdownRun);
      assert.ok(currentBuild());
      const plain = await vscode.languages.setTextDocumentLanguage(await vscode.workspace.openTextDocument(runUri), "plaintext");
      await waitFor(() => currentBuild() === undefined, "Closing the source instance invalidates its map while the process remains owned");
      assert.strictEqual(currentRun(), shutdownRun);
      await vscode.languages.setTextDocumentLanguage(plain, "zx-spectrum-basic");
      assert.equal(currentBuild(), undefined, "Reopening the source does not validate an older session");
      assert.equal((await api.runner.shutdown()).kind, "success");
      assert.equal(api.runner.active, undefined);
      await assert.rejects(Promise.resolve(vscode.workspace.fs.stat(vscode.Uri.file(shutdownRun.session.artifact.path))));
      await assert.rejects(Promise.resolve(vscode.workspace.fs.stat(vscode.Uri.file(shutdownRun.metadataPath))));
    } finally {
      await vscode.commands.executeCommand("zxcode.stop");
      await emulatorSettings.update("emulator.executable", undefined, vscode.ConfigurationTarget.Workspace);
    }
  }
  console.log("ZXCode real-host smoke passed: language registration/activation, sessions, completion acceptance, live Problems, diagnostics, native navigation/references/hover/outline, build/check commands, settings, Run/Stop/replacement/build identity, UTF-16/CRLF ranges and stale-result rejection");
}
