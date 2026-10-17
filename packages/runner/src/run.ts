import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join } from "node:path";
import { checkProgram, writeBasicTap } from "@zxcode/core";
import type { Diagnostic, SourceDocument } from "@zxcode/core";
import type { EmulatorArtifact, EmulatorBackend, EmulatorFailure, EmulatorLaunchOptions, EmulatorSession } from "./index.js";
export interface RunSource {readonly source: SourceDocument; readonly version: number}
export interface ManagedRun {
  readonly session: EmulatorSession;
  readonly sourceId: string;
  readonly version: number;
  readonly buildId: string;
  readonly diagnostics: readonly Diagnostic[];
}
export type BuildRunResult = {readonly kind:"success"; readonly run:ManagedRun} | {readonly kind:"build-error";readonly diagnostics:readonly Diagnostic[]} | {readonly kind:"error";readonly failure:EmulatorFailure;readonly diagnostics:readonly Diagnostic[]};
interface PreparedRun {readonly sourceId:string;readonly version:number;readonly buildId:string;readonly tap:Uint8Array;readonly diagnostics:readonly Diagnostic[]}
const error = (code: EmulatorFailure["code"], message: string, diagnostics: readonly Diagnostic[] = []): BuildRunResult => ({kind:"error",failure:{kind:"error",code,message},diagnostics});
/** Serial owner of build/run replacement and private TAP lifetime, without editor APIs. */
export class RunCoordinator {
  #active: ManagedRun | undefined;
  #starting: AbortController | undefined;
  #queue: Promise<void> = Promise.resolve();
  #sequence = 0;
  #disposed = false;
  constructor(readonly backend: EmulatorBackend, readonly temporaryRoot = tmpdir()) {}
  get active(): ManagedRun | undefined {return this.#active;}
  run(input: RunSource, options: EmulatorLaunchOptions = {}): Promise<BuildRunResult> {
    if (this.#disposed) return Promise.resolve(error("cancelled","Run coordinator is disposed."));
    if (!Number.isSafeInteger(input.version) || input.version < 0 || !isAbsolute(this.temporaryRoot)) return Promise.resolve(error("invalid-request","Run requires a nonnegative source version and absolute temporary root."));
    const checked = checkProgram(input.source);
    if (checked.kind === "error") return Promise.resolve({kind:"build-error",diagnostics:checked.diagnostics});
    const first = checked.encodedProgram.lines[0];
    if (first === undefined) return Promise.resolve(error("invalid-request","Add a numbered BASIC line before Run Spectrum.",checked.diagnostics));
    if (!this.backend.capabilities.features.includes("stop")) return Promise.resolve(error("unsupported-operation","Managed runs require a backend that supports Stop.",checked.diagnostics));
    const program = checked.encodedProgram.programBytes;
    const tap = writeBasicTap(program,{filenameBytes:Uint8Array.from([90,88,67,79,68,69,32,32,32,32]),autostart:first.basicLineNumber,variablesOffset:program.length}).tapBytes;
    const buildId = createHash("sha256").update(JSON.stringify({sourceId:input.source.id,text:input.source.text,version:input.version,target:"spectrum-48k",autostart:first.basicLineNumber})).update(tap).digest("hex");
    const prepared: PreparedRun = {sourceId:input.source.id,version:input.version,buildId,tap,diagnostics:checked.diagnostics};
    const sequence = ++this.#sequence;
    this.#starting?.abort();
    const result = this.#queue.then(() => this.#launch(prepared,sequence,options));
    this.#queue = result.then(() => undefined,() => undefined);
    return result;
  }
  async #stopActive(): Promise<{readonly kind:"success"} | EmulatorFailure> {
    const active = this.#active;
    try {
    if (active === undefined) return {kind:"success"};
    if (active.session.state === "running") {
      const stopped = await active.session.stop();
      if (stopped.kind === "error") return stopped;
    }
    await active.session.finished;
    if (this.#active === active) this.#active = undefined;
    return {kind:"success"};
    } catch (caught) {return {kind:"error",code:"runtime-failed",message:`Could not stop the current emulator: ${caught instanceof Error ? caught.message : String(caught)}`};}
  }
  async #launch(prepared: PreparedRun, sequence: number, options: EmulatorLaunchOptions): Promise<BuildRunResult> {
    const obsolete = (): boolean => this.#disposed || sequence !== this.#sequence || options.signal?.aborted === true;
    const cancelled = (): BuildRunResult => error("cancelled","Run startup was cancelled or superseded.",prepared.diagnostics);
    if (obsolete()) return cancelled();
    let directory: string | undefined;
    try {
      directory = await mkdtemp(join(this.temporaryRoot,"zxcode-run-"));
      const path = join(directory,"program.tap");
      await writeFile(path,prepared.tap);
      if (obsolete()) return cancelled();
      const stopped = await this.#stopActive();
      if (stopped.kind === "error") return {kind:"error",failure:stopped,diagnostics:prepared.diagnostics};
      if (obsolete()) return cancelled();
      const abort = new AbortController();
      const externalAbort = (): void => abort.abort();
      options.signal?.addEventListener("abort",externalAbort,{once:true});
      if (options.signal?.aborted) abort.abort();
      this.#starting = abort;
      let launched;
      const artifact: EmulatorArtifact = Object.freeze({path,format:"tap",target:"spectrum-48k",buildId:prepared.buildId});
      try {launched = await this.backend.launch({artifact},{signal:abort.signal});}
      finally {options.signal?.removeEventListener("abort",externalAbort);if (this.#starting === abort) this.#starting = undefined;}
      if (launched.kind === "error") return {kind:"error",failure:launched,diagnostics:prepared.diagnostics};
      const owned = directory;
      directory = undefined;
      const original = launched.session;
      const session: EmulatorSession = Object.freeze({
        id:original.id,backendId:original.backendId,artifact:original.artifact,
        get state() {return original.state;},
        finished:original.finished.then(async (exit) => {
          await rm(owned,{recursive:true,force:true,maxRetries:3}).catch(() => undefined);
          if (this.#active === managed) this.#active = undefined;
          return exit;
        }),stop:() => original.stop()
      });
      const managed: ManagedRun = Object.freeze({session,sourceId:prepared.sourceId,version:prepared.version,buildId:prepared.buildId,diagnostics:prepared.diagnostics});
      this.#active = managed;
      if (obsolete()) {
        const stopped = await this.#stopActive();
        return stopped.kind === "error" ? {kind:"error",failure:stopped,diagnostics:prepared.diagnostics} : cancelled();
      }
      return {kind:"success",run:managed};
    } catch (caught) {return error("launch-failed",`Could not prepare or launch Spectrum run: ${caught instanceof Error ? caught.message : String(caught)}`,prepared.diagnostics);}
    finally {if (directory !== undefined) await rm(directory,{recursive:true,force:true,maxRetries:3}).catch(() => undefined);}
  }
  stop(): Promise<{readonly kind:"success"} | EmulatorFailure> {
    ++this.#sequence;
    this.#starting?.abort();
    const result = this.#queue.then(() => this.#stopActive());
    this.#queue = result.then(() => undefined,() => undefined);
    return result;
  }
  dispose(): Promise<{readonly kind:"success"} | EmulatorFailure> {this.#disposed = true;return this.stop();}
}
