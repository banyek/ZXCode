import * as vscode from "vscode";
import { createFuseBackend, RunCoordinator } from "@zxcode/runner";
import type { EmulatorFailure, ManagedRun } from "@zxcode/runner";
import { EditorDocuments } from "./documents.js";
import { EditorDiagnostics } from "./diagnostics.js";
import { LANGUAGE_ID } from "./language.js";
import { emulatorConfiguration } from "./settings.js";
export interface EditorRunResult {
  readonly kind:"success" | "build-error" | "error";
  readonly message:string;
  readonly code?:string;
  readonly buildId?:string;
  readonly version?:number;
}
export class EditorRunner implements vscode.Disposable {
  readonly #coordinator = new RunCoordinator(createFuseBackend());
  readonly #registrations: vscode.Disposable;
  #pending = 0;
  #disposed = false;
  #shutdown: Promise<{readonly kind:"success"} | EmulatorFailure> | undefined;
  constructor(readonly documents: EditorDocuments, readonly diagnostics: EditorDiagnostics, readonly output: vscode.OutputChannel) {
    this.#registrations = vscode.Disposable.from(
      vscode.commands.registerCommand("zxcode.run",(source?:vscode.Uri) => this.run(source)),
      vscode.commands.registerCommand("zxcode.stop",() => this.stop())
    );
    this.#updateContext();
  }
  get active(): ManagedRun | undefined {return this.#coordinator.active;}
  #updateContext(): void {
    for (const [key,value] of [["zxcode.running",this.active !== undefined],["zxcode.starting",this.#pending > 0]] as const) void vscode.commands.executeCommand("setContext",key,value).then(() => undefined,() => undefined);
  }
  async run(source?: vscode.Uri): Promise<EditorRunResult> {
    this.output.show(true);
    try {
      if (this.#disposed) throw new Error("ZXCode runner is disposed.");
      if (!vscode.workspace.isTrusted) throw new Error("Trust this workspace before launching an external emulator.");
      const document = source === undefined ? vscode.window.activeTextEditor?.document : await vscode.workspace.openTextDocument(source);
      if (document === undefined || document.isClosed || document.languageId !== LANGUAGE_ID) throw new Error("Select a ZX Spectrum BASIC document to run.");
      const snapshot = this.documents.snapshot(document);
      const backend = createFuseBackend(emulatorConfiguration(document.uri));
      this.diagnostics.refresh(document);
      this.output.appendLine(`Run: ${document.uri.toString()} (version ${snapshot.identity.version})`);
      ++this.#pending;this.#updateContext();
      try {
        return await vscode.window.withProgress({location:vscode.ProgressLocation.Notification,title:"ZXCode: Run Spectrum",cancellable:true},async (_progress,token) => {
          const abort = new AbortController();
          const cancellation = token.onCancellationRequested(() => abort.abort());
          if (token.isCancellationRequested) abort.abort();
          try {
            const result = await this.#coordinator.run({source:snapshot.source,version:snapshot.identity.version,backend},{signal:abort.signal});
            const diagnostics = result.kind === "success" ? result.run.diagnostics : result.diagnostics;
            for (const diagnostic of diagnostics) {
              const position = snapshot.source.positionAt(diagnostic.range.start);
              this.output.appendLine(`${position.line + 1}:${position.column + 1}: ${diagnostic.severity} ${diagnostic.code}: ${diagnostic.message}`);
            }
            if (result.kind === "build-error") {
              const message = "Run stopped: BASIC compatibility check failed. See Problems and ZXCode Output.";
              this.output.appendLine(message);return {kind:"build-error",message};
            }
            if (result.kind === "error") {this.output.appendLine(result.failure.message);return {kind:"error",code:result.failure.code,message:result.failure.message};}
            const run = result.run;
            const message = `Running source version ${run.version}, build ${run.buildId}: ${run.session.artifact.path}`;
            this.output.appendLine(message);
            void run.session.finished.then((exit) => {
              if (!this.#disposed) this.output.appendLine(`Build ${run.buildId}: ${exit.state}${exit.failure === undefined ? "" : `: ${exit.failure.message}`}`);
              this.#updateContext();
            }).catch(() => undefined);
            this.#updateContext();
            return {kind:"success",message,buildId:run.buildId,version:run.version};
          } finally {cancellation.dispose();}
        });
      } finally {--this.#pending;this.#updateContext();}
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.output.appendLine(`ZXCode: ${message}`);
      return {kind:"error",message};
    }
  }
  async stop(): Promise<EditorRunResult> {
    const result = await this.#coordinator.stop();
    this.#updateContext();
    const message = result.kind === "success" ? "Spectrum session stopped." : result.message;
    if (!this.#disposed) this.output.appendLine(message);
    return result.kind === "success" ? {kind:"success",message} : {kind:"error",message,code:result.code};
  }
  shutdown(): Promise<{readonly kind:"success"} | EmulatorFailure> {
    this.#shutdown ??= this.#coordinator.dispose().then((result) => {
      if (result.kind === "error" && !this.#disposed) this.output.appendLine(result.message);
      this.#updateContext();return result;
    });
    return this.#shutdown;
  }
  dispose(): void {this.#registrations.dispose();this.#disposed = true;void this.shutdown();}
}
