import type { BuildableProgram } from "../semantic/program.js";
import type { SourceRange } from "../source/document.js";

/** Offset/length measured in bytes from the start of the BASIC program image. */
export interface EncodedRange {
  readonly offset: number;
  readonly length: number;
}

export interface EncodedStatementMapping {
  readonly sourceRange: SourceRange;
  readonly encodedRange?: EncodedRange;
}

export interface EncodedLineMapping {
  readonly basicLineNumber: number;
  readonly sourceRange: SourceRange;
  readonly encodedOffset: number;
  readonly encodedLength: number;
  readonly statements: readonly EncodedStatementMapping[];
}

/** Authentic BASIC image only: no TAP prefixes, flags, headers, or checksums. */
export interface EncodedProgram {
  readonly sourceId: string;
  readonly programBytes: Uint8Array;
  readonly lines: readonly EncodedLineMapping[];
}

export type BasicProgramEncoder<TProgram> = (program: BuildableProgram<TProgram>) => EncodedProgram;
