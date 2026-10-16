import type { Diagnostic } from "../source/diagnostic.js";
import type { SourceDocument } from "../source/document.js";

export interface AnalyzedProgram<TProgram> {
  readonly source: SourceDocument;
  readonly program: TProgram;
  readonly diagnostics: readonly Diagnostic[];
}

declare const buildableProgram: unique symbol;

/** Only semantic validation can attest that the program is safe to encode. */
export interface BuildableProgram<TProgram> extends AnalyzedProgram<TProgram> {
  readonly [buildableProgram]: true;
}
