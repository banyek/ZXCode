import { checkProgram } from "./build.js";
import { importTapSource } from "./tap-source-import.js";
import { readBasicTap } from "./tap/reader.js";
import { writeBasicTap } from "./tap/writer.js";
import type { SourceDocument } from "./source/document.js";
import type { TapArtifact } from "./tap/artifact.js";
export type PreservedTapResult =
  | {readonly kind:"success";readonly guarantee:"identical-tap-bytes";readonly tap:TapArtifact;readonly preservedVariableBytes:number}
  | {readonly kind:"blocked";readonly reason:"unsupported-reference" | "invalid-source" | "changed-program" | "tap-mismatch";readonly issues:readonly string[]};
/** An explicit original reference, never provenance metadata alone, proves fidelity. */
export function rebuildPreservedTap(source:SourceDocument,reference:Uint8Array):PreservedTapResult {
  if (!(reference instanceof Uint8Array)) throw new TypeError("Expected reference TAP bytes.");
  const bytes=Uint8Array.from(reference);
  const blocked=(reason:"unsupported-reference" | "invalid-source" | "changed-program" | "tap-mismatch",issues:readonly string[]):PreservedTapResult=>Object.freeze({kind:"blocked",reason,issues:Object.freeze([...issues])});
  const imported=importTapSource(bytes,{variables:"source-only"});
  if(imported.kind === "blocked") return blocked("unsupported-reference",imported.issues);
  const parsed=readBasicTap(bytes);
  if(parsed.kind === "error") return blocked("unsupported-reference",parsed.issues.map(issue=>issue.message));
  const checked=checkProgram(source);
  if(checked.kind === "error") return blocked("invalid-source",checked.diagnostics.filter(diagnostic=>diagnostic.severity === "error").map(diagnostic=>`${diagnostic.code}: ${diagnostic.message}`));
  const program=checked.encodedProgram.programBytes, original=parsed.programData.slice(0,parsed.metadata.variablesOffset);
  if(program.length !== original.length || program.some((byte,index)=>byte !== original[index])) return blocked("changed-program",["Compiled BASIC bytes differ from the reference; use ordinary Build TAP for an edited program."]);
  const tap=writeBasicTap(parsed.programData,parsed.metadata);
  if(tap.tapBytes.length !== bytes.length || tap.tapBytes.some((byte,index)=>byte !== bytes[index])) return blocked("tap-mismatch",["Rebuilt container does not reproduce the complete reference TAP."]);
  return Object.freeze({kind:"success",guarantee:"identical-tap-bytes",tap,preservedVariableBytes:parsed.programData.length-parsed.metadata.variablesOffset});
}
