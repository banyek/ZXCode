import { execFile } from "node:child_process";
import { constants } from "node:fs";
import { access, mkdtemp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, isAbsolute, join } from "node:path";
import { readBasicTap } from "@zxcode/core";
import { promisify } from "node:util";
import type { EmulatorBackend, EmulatorFailure, EmulatorLaunchOptions, EmulatorLaunchRequest, EmulatorLaunchResult, EmulatorSession } from "./index.js";
import { startExternalProcess } from "./process.js";
const execute = promisify(execFile);
export interface FuseConfiguration {
  readonly executable?: string;
  readonly configurationFormat?: "xml" | "ini";
}
const problem = (code: EmulatorFailure["code"], message: string): EmulatorFailure => ({kind:"error",code,message});
export function fuseArguments(request: EmulatorLaunchRequest): readonly string[] {
  return Object.freeze(["--machine","48","--auto-load","--no-autosave-settings","--no-confirm-actions","--no-sound","--tape",request.artifact.path]);
}
/** Child-only environment; never changes parent configuration or process.env. */
export async function prepareFuseConfiguration(directory: string, platform: NodeJS.Platform, format: "xml" | "ini"): Promise<NodeJS.ProcessEnv> {
  const folder = platform === "win32" ? directory : join(directory,"fuse-emulator");
  await mkdir(folder,{recursive:true});
  await writeFile(join(folder,platform === "win32" ? "fuse.cfg" : "fuserc"),format === "xml" ? "<settings/>\n" : "");
  return {...process.env,...(platform === "win32" ? {USERPROFILE:directory} : {XDG_CONFIG_HOME:directory})};
}
async function probe(executable: string, environment: NodeJS.ProcessEnv, options: EmulatorLaunchOptions): Promise<EmulatorFailure | undefined> {
  try {
    const info = await stat(executable);
    if (!info.isFile()) return problem("not-executable", "Fuse executable must be a file, not an application directory.");
    await access(executable,constants.X_OK);
    const result = await execute(executable,["--version"],{env:environment,timeout:2000,killSignal:"SIGKILL",maxBuffer:8192,...(options.signal === undefined ? {} : {signal:options.signal})});
    const version = /The Free Unix Spectrum Emulator \(Fuse\) version (\d+)\.(\d+)/i.exec(result.stdout);
    if (version === null) return problem("not-executable", `Executable does not identify itself as Spectrum Fuse: ${executable}`);
    if (Number(version[1]) < 1 || Number(version[1]) === 1 && Number(version[2]) < 8) return problem("unsupported-version", "Fuse 1.8 or later is required for private configuration; configure a newer CLI executable.");
    return undefined;
  } catch (error) {
    if (options.signal?.aborted) return problem("cancelled", "Fuse startup was cancelled.");
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return problem("not-found", `Fuse executable was not found: ${executable}`);
    if (code === "EACCES" || code === "EPERM") return problem("not-executable", `Fuse executable is not executable: ${executable}`);
    return problem("launch-failed", `Fuse --version failed or exceeded its 2-second deadline: ${error instanceof Error ? error.message.slice(0,512) : String(error)}`);
  }
}
async function discover(configuration: FuseConfiguration, environment: NodeJS.ProcessEnv, options: EmulatorLaunchOptions): Promise<string | EmulatorFailure> {
  if (configuration.executable !== undefined && configuration.executable !== "") {
    if (!isAbsolute(configuration.executable)) return problem("invalid-request", "Configure an absolute Fuse executable path.");
    return await probe(configuration.executable,environment,options) ?? configuration.executable;
  }
  const names = process.platform === "win32" ? ["fuse.exe"] : ["fuse","fuse-sdl2","fuse-gtk"];
  for (const directory of (process.env.PATH ?? "").split(delimiter).filter((path) => path !== "" && isAbsolute(path))) {
    for (const name of names) {
      const executable = join(directory,name);
      const error = await probe(executable,environment,options);
      if (error === undefined) return executable;
      if (error.code === "cancelled") return error;
    }
  }
  return problem("not-found", "Spectrum Fuse was not found on PATH. Install Fuse separately and configure its absolute executable path.");
}
export function createFuseBackend(configuration: FuseConfiguration = {}): EmulatorBackend {
  const configured = Object.freeze({...configuration});
  return Object.freeze({
    id:"fuse",
    capabilities:Object.freeze({transport:"external-process" as const,formats:Object.freeze(["tap" as const]),targets:Object.freeze(["spectrum-48k" as const]),features:Object.freeze(["stop" as const])}),
    async launch(request: EmulatorLaunchRequest, options: EmulatorLaunchOptions = {}): Promise<EmulatorLaunchResult> {
      if (!["darwin","linux","win32"].includes(process.platform)) return problem("unsupported-platform", "Fuse integration supports macOS, Linux and Windows CLI executables.");
      if (options.signal?.aborted) return problem("cancelled", "Fuse startup was cancelled.");
      if (request?.artifact === undefined) return problem("invalid-request", "A built TAP artifact is required.");
      request = Object.freeze({artifact:Object.freeze({...request.artifact}),...(request.workingDirectory === undefined ? {} : {workingDirectory:request.workingDirectory})});
      if (configured.configurationFormat !== undefined && !["xml","ini"].includes(configured.configurationFormat)) return problem("invalid-request", "Fuse configuration format must be xml or ini.");
      if (request.artifact.format !== "tap" || request.artifact.target !== "spectrum-48k") return problem("unsupported-artifact", "Fuse requires a Spectrum 48K TAP artifact.");
      if (typeof request.artifact.path !== "string" || !isAbsolute(request.artifact.path) || typeof request.artifact.buildId !== "string" || request.artifact.buildId.trim() === "" || request.workingDirectory !== undefined && (typeof request.workingDirectory !== "string" || !isAbsolute(request.workingDirectory))) return problem("invalid-request", "Fuse needs an absolute TAP/working-directory path and a nonempty build id.");
      try {
        const info = await stat(request.artifact.path);
        if (!info.isFile() || info.size < 2 || info.size > 65560) return problem("invalid-request", "TAP artifact must be a readable BASIC TAP file of at most 65560 bytes.");
        await access(request.artifact.path,constants.R_OK);
        const tape = readBasicTap(await readFile(request.artifact.path));
        if (tape.kind === "error") return problem("invalid-request", `Invalid BASIC TAP artifact: ${tape.issues[0]?.message ?? "invalid framing"}`);
      } catch (error) {return problem("invalid-request", `Cannot read TAP artifact: ${error instanceof Error ? error.message : String(error)}`);}
      let directory: string | undefined;
      try {
        directory = await mkdtemp(join(tmpdir(),"zxcode-fuse-"));
        const environment = await prepareFuseConfiguration(directory,process.platform,configured.configurationFormat ?? (process.platform === "win32" ? "ini" : "xml"));
        const executable = await discover(configured,environment,options);
        if (typeof executable !== "string") return executable;
        const result = await startExternalProcess(request.artifact,{backendId:"fuse",executable,arguments:fuseArguments(request),environment,...(request.workingDirectory === undefined ? {} : {workingDirectory:request.workingDirectory})},options);
        if (result.kind === "error") return result;
        const owned = directory;
        directory = undefined;
        const session: EmulatorSession = Object.freeze({
          id:result.session.id,backendId:result.session.backendId,artifact:result.session.artifact,
          get state() {return result.session.state;},
          finished:result.session.finished.then(async (exit) => {await rm(owned,{recursive:true,force:true,maxRetries:3}).catch(() => undefined);return exit;}),
          stop:() => result.session.stop()
        });
        return {kind:"success",session};
      } catch (error) {return problem("launch-failed", `Fuse configuration/startup failed: ${error instanceof Error ? error.message : String(error)}`);}
      finally {if (directory !== undefined) await rm(directory,{recursive:true,force:true,maxRetries:3}).catch(() => undefined);}
    }
  });
}
