import * as vscode from "vscode";
export function buildOutputDirectory(source: vscode.Uri): string {
  const configuration = vscode.workspace.getConfiguration("zxcode", source);
  if (configuration.get<unknown>("target.profile", "spectrum-48k") !== "spectrum-48k") throw new Error("Unsupported zxcode.target.profile: choose spectrum-48k.");
  const directory = configuration.get<unknown>("build.outputDirectory", "");
  if (typeof directory !== "string" || directory !== "" && directory.split("/").some((part) => part === "" || part === "." || part === ".." || /[\\\\:]/.test(part))) throw new Error("zxcode.build.outputDirectory must be a relative subdirectory with no dot segments.");
  return directory;
}
