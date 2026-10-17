import { inspectBasicTap } from "./import.js";
export interface TapSourceImportOptions {readonly variables?:"reject" | "source-only"}
export type TapSourceImport =
  | {readonly kind:"blocked";readonly reason:"tap-error" | "unsupported-program" | "saved-variables";readonly issues:readonly string[]}
  | {readonly kind:"ready";readonly source:string;readonly guarantee:"identical-basic-bytes";readonly metadata:{readonly filenameBytes:readonly number[];readonly autostart:number;readonly variablesOffset:number;readonly omittedVariableBytes:number}};
/** Product boundary: unsupported candidates never become accepted editable source. */
export function importTapSource(bytes:Uint8Array,options:TapSourceImportOptions = {}):TapSourceImport {
  if (options.variables !== undefined && options.variables !== "reject" && options.variables !== "source-only") throw new TypeError("Unknown saved-variable import policy.");
  const blocked = (reason:"tap-error" | "unsupported-program" | "saved-variables",issues:readonly string[]):TapSourceImport => Object.freeze({kind:"blocked",reason,issues:Object.freeze([...issues])});
  const inspected = inspectBasicTap(bytes);
  if (inspected.kind === "tap-error") return blocked("tap-error",inspected.result.issues.map(issue=>`${issue.code} at byte ${issue.offset}: ${issue.message}`));
  if (inspected.program.kind !== "exact") return blocked("unsupported-program",inspected.program.reasons);
  if (inspected.variables.length > 0 && options.variables !== "source-only") return blocked("saved-variables",[`${inspected.variables.length} saved-variable bytes cannot be recreated from BASIC source; explicitly select source-only import to omit them.`]);
  return Object.freeze({kind:"ready",source:inspected.program.candidateSource,guarantee:"identical-basic-bytes",metadata:Object.freeze({filenameBytes:Object.freeze(Array.from(inspected.tap.metadata.filenameBytes)),autostart:inspected.tap.metadata.autostart,variablesOffset:inspected.tap.metadata.variablesOffset,omittedVariableBytes:inspected.variables.length})});
}
