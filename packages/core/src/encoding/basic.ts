import { assertBuildableProgram } from "../semantic/program.js";
import type { BasicProgram, BuildableProgram } from "../semantic/program.js";
import { createDiagnostic, DiagnosticCodes } from "../source/diagnostic.js";
import type { Diagnostic } from "../source/diagnostic.js";
import type { SourceRange } from "../source/document.js";
import { encodeNumericLiteral } from "./numeric.js";
import type { EncodedLineMapping, EncodedProgram, EncodedStatementMapping } from "./program.js";

export const M1_BASIC_BYTE_LIMIT = 32768;

export class EncodingError extends Error {
  readonly diagnostic: Diagnostic;

  constructor(range: SourceRange) {
    const diagnostic = createDiagnostic({ code: DiagnosticCodes.programTooLarge, severity: "error", category: "compatibility", message: `BASIC image exceeds M1's supported ${M1_BASIC_BYTE_LIMIT}-byte build budget.`, range });
    super(diagnostic.message);
    this.name = "EncodingError";
    this.diagnostic = diagnostic;
  }
}

/** Encode only validated semantic nodes; source text is never parsed here. */
export function encodeBasicProgram(program: BuildableProgram<BasicProgram>): EncodedProgram {
  assertBuildableProgram(program);
  const bytes: number[] = [];
  const lines: EncodedLineMapping[] = [];
  for (const line of program.program.lines) {
    const encodedOffset = bytes.length;
    const body: number[] = [];
    const statements: EncodedStatementMapping[] = [];
    if (encodedOffset + 4 > M1_BASIC_BYTE_LIMIT) throw new EncodingError(line.range);
    const emit = (byte: number): void => {
      if (encodedOffset + 4 + body.length >= M1_BASIC_BYTE_LIMIT) throw new EncodingError(line.range);
      body.push(byte);
    };
    for (let index = 0; index < line.statements.length; index++) {
      if (index !== 0) emit(0x3a);
      const statement = line.statements[index]!;
      const start = body.length;
      if (statement.kind !== "print") emit(statement.kind === "cls" ? 0xfb : 0xe2);
      else {
        emit(0xf5);
        for (const item of statement.items) {
          if (item.kind === "print-separator") emit(item.separator.charCodeAt(0));
          else if (item.expression.kind === "string") {
            emit(0x22);
            for (const byte of item.expression.bytes) emit(byte);
            emit(0x22);
          } else {
            for (const character of item.expression.value.lexeme) emit(character.charCodeAt(0));
            for (const byte of encodeNumericLiteral(item.expression.value)) emit(byte);
          }
        }
      }
      statements.push(Object.freeze({ sourceRange: statement.range, encodedRange: Object.freeze({ offset: encodedOffset + 4 + start, length: body.length - start }) }));
    }
    emit(0x0d);
    bytes.push(line.lineNumber >>> 8, line.lineNumber & 0xff, body.length & 0xff, body.length >>> 8);
    for (const byte of body) bytes.push(byte);
    lines.push(Object.freeze({ basicLineNumber: line.lineNumber, sourceRange: line.range, encodedOffset, encodedLength: body.length + 4, statements: Object.freeze(statements) }));
  }
  return Object.freeze({ sourceId: program.source.id, programBytes: Uint8Array.from(bytes), lines: Object.freeze(lines) });
}
