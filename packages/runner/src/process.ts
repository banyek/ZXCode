import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import type { EmulatorArtifact, EmulatorExit, EmulatorFailure, EmulatorLaunchOptions, EmulatorLaunchResult, EmulatorSession, EmulatorState } from "./index.js";
export interface ExternalProcessInvocation {
  readonly backendId: string;
  readonly executable: string;
  readonly arguments: readonly string[];
  readonly environment?: NodeJS.ProcessEnv;
  readonly workingDirectory?: string;
  readonly stopGraceMs?: number;
}
const failure = (code: EmulatorFailure["code"], message: string): EmulatorFailure => ({kind:"error",code,message});
/** A shell-free process owner shared by external backends. */
export async function startExternalProcess(artifact: EmulatorArtifact, invocation: ExternalProcessInvocation, options: EmulatorLaunchOptions = {}): Promise<EmulatorLaunchResult> {
  if (options.signal?.aborted) return failure("cancelled", "Emulator startup was cancelled.");
  const grace = invocation.stopGraceMs ?? 1500;
  if (!Number.isSafeInteger(grace) || grace < 1 || grace > 30000) return failure("invalid-request", "Stop grace period must be between 1 and 30000 ms.");
  try {
    const child = spawn(invocation.executable, [...invocation.arguments], {
      shell:false,stdio:["ignore","ignore","pipe"],
      ...(invocation.environment === undefined ? {} : {env:invocation.environment}),
      ...(invocation.workingDirectory === undefined ? {} : {cwd:invocation.workingDirectory})
    });
    let state: EmulatorState = "running";
    let started = false;
    let stopping = false;
    let cancelled = false;
    let stderr = "";
    let runtimeError: Error | undefined;
    let finish!: (exit: EmulatorExit) => void;
    const finished = new Promise<EmulatorExit>((resolve) => {finish = resolve;});
    let settled = false;
    const complete = (exit: EmulatorExit): void => {
      if (settled) return;
      settled = true;
      state = exit.state;
      finish(Object.freeze(exit));
    };
    const within = async (milliseconds: number): Promise<boolean> => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {return await Promise.race([finished.then(() => true),new Promise<boolean>((resolve) => {timer = setTimeout(() => resolve(false), milliseconds);})]);}
      finally {if (timer !== undefined) clearTimeout(timer);}
    };
    let stopResult: Promise<{readonly kind:"success"} | EmulatorFailure> | undefined;
    const session: EmulatorSession = Object.freeze({
      id:randomUUID(),backendId:invocation.backendId,artifact:Object.freeze({...artifact}),
      get state() {return state;},finished,
      stop() {
        stopResult ??= (async () => {
          if (settled) return {kind:"success" as const};
          stopping = true;
          child.kill("SIGTERM");
          if (!await within(grace)) {
            child.kill("SIGKILL");
            if (!await within(grace)) return failure("runtime-failed", "Emulator could not be stopped; close its window manually.");
          }
          return {kind:"success" as const};
        })().catch((error: unknown) => failure("runtime-failed", `Could not stop emulator: ${error instanceof Error ? error.message : String(error)}`));
        return stopResult;
      }
    });
    child.stderr?.on("data", (data: Buffer) => {stderr = (stderr + data.toString("utf8")).slice(-4096);});
    return await new Promise<EmulatorLaunchResult>((resolve) => {
      const abort = (): void => {cancelled = true;child.kill("SIGKILL");};
      const detach = (): void => options.signal?.removeEventListener("abort",abort);
      options.signal?.addEventListener("abort",abort,{once:true});
      if (options.signal?.aborted) abort();
      child.once("spawn", () => {
        started = true;
        detach();
        if (cancelled) {resolve(failure("cancelled", "Emulator startup was cancelled."));return;}
        resolve({kind:"success",session});
      });
      child.once("error", (error) => {
        detach();
        runtimeError = error;
        if (!started) {
          const problem = cancelled ? failure("cancelled", "Emulator startup was cancelled.") : failure("launch-failed", `Could not start ${invocation.backendId}: ${error.message}`);
          complete({state:"failed",code:null,signal:null,failure:problem});
          resolve(problem);
        }
      });
      child.once("close", (code, signal) => {
        detach();
        if (cancelled) {complete({state:"stopped",code,signal});return;}
        if (stopping) {complete({state:"stopped",code,signal});return;}
        if (code === 0 && runtimeError === undefined) complete({state:"exited",code,signal});
        else complete({state:"failed",code,signal,failure:failure("runtime-failed", `${invocation.backendId} exited ${code === null ? `with signal ${signal ?? "unknown"}` : `with code ${code}`}${runtimeError === undefined ? "" : `: ${runtimeError.message}`}${stderr.trim() === "" ? "" : `: ${stderr.trim()}`}`)});
      });
    });
  } catch (error) {return failure("launch-failed", `Could not start ${invocation.backendId}: ${error instanceof Error ? error.message : String(error)}`);}
}
