import * as vscode from "vscode";
export function validateTargetProfile(source: vscode.Uri): void {
  if (vscode.workspace.getConfiguration("zxcode", source).get<unknown>("target.profile", "spectrum-48k") !== "spectrum-48k") throw new Error("Unsupported zxcode.target.profile: choose spectrum-48k.");
}
export function buildOutputDirectory(source: vscode.Uri): string {
  validateTargetProfile(source);
  const configuration = vscode.workspace.getConfiguration("zxcode", source);
  const directory = configuration.get<unknown>("build.outputDirectory", "");
  if (typeof directory !== "string" || directory !== "" && directory.split("/").some((part) => part === "" || part === "." || part === ".." || /[\\\\:]/.test(part))) throw new Error("zxcode.build.outputDirectory must be a relative subdirectory with no dot segments.");
  return directory;
}

export function emulatorConfiguration(source: vscode.Uri): {executable?:string;configurationFormat?:"xml"|"ini"} {
  validateTargetProfile(source);
  const configuration = vscode.workspace.getConfiguration("zxcode", source);
  if (configuration.get<unknown>("emulator.backend", "fuse") !== "fuse") throw new Error("Unsupported emulator backend: choose fuse.");
  const executable = configuration.get<unknown>("emulator.executable", "");
  const format = configuration.get<unknown>("emulator.configurationFormat", "auto");
  if (typeof executable !== "string") throw new Error("Emulator executable setting must be a path string.");
  if (format !== "auto" && format !== "xml" && format !== "ini") throw new Error("Emulator configuration format must be auto, xml or ini.");
  return {...(executable === "" ? {} : {executable}),...(format === "auto" ? {} : {configurationFormat:format})};
}
