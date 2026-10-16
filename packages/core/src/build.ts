import { encodeBasicProgram, EncodingError } from "./encoding/basic.js";
import type { EncodedProgram } from "./encoding/program.js";
import { analyzeBasic } from "./semantic/program.js";
import type { Diagnostic } from "./source/diagnostic.js";
import type { SourceDocument } from "./source/document.js";
import { parseBasic } from "./syntax/parser.js";
import { writeBasicTap } from "./tap/writer.js";
import type { TapArtifact } from "./tap/artifact.js";

export interface PipelineFailure {
  readonly kind: "error";
  readonly diagnostics: readonly Diagnostic[];
}

export interface CheckedProgram {
  readonly kind: "success";
  readonly encodedProgram: EncodedProgram;
  readonly diagnostics: readonly Diagnostic[];
}

export interface TapBuildOptions {
  readonly filenameBytes: Uint8Array;
  readonly autostart: number;
}

export interface BuiltTap extends CheckedProgram {
  readonly tap: TapArtifact;
}

/** Full shared compatibility check, including binary limits, with no TAP output. */
export function checkProgram(source: SourceDocument): CheckedProgram | PipelineFailure {
  const result = analyzeBasic(parseBasic(source));
  if (result.kind === "invalid") return Object.freeze({ kind: "error", diagnostics: result.analysis.diagnostics });
  try {
    return Object.freeze({ kind: "success", encodedProgram: encodeBasicProgram(result.analysis), diagnostics: result.analysis.diagnostics });
  } catch (error) {
    if (!(error instanceof EncodingError)) throw error;
    return Object.freeze({ kind: "error", diagnostics: Object.freeze([...result.analysis.diagnostics, error.diagnostic]) });
  }
}

export function buildTap(source: SourceDocument, options: TapBuildOptions): BuiltTap | PipelineFailure {
  const result = checkProgram(source);
  if (result.kind === "error") return result;
  const bytes = result.encodedProgram.programBytes;
  const tap = writeBasicTap(bytes, { ...options, variablesOffset: bytes.length });
  return Object.freeze({ ...result, tap });
}
