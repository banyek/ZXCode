import { emitInputStatement } from "./input.js";
import { emitPrintStatement } from "./print.js";
import { emitSimpleCommand } from "./simple-commands.js";
import { romTokenBySpelling } from "../source/rom-tokens.js";
import { assertBuildableProgram } from "../semantic/program.js";
import type { BasicProgram, BasicStatement, BuildableProgram } from "../semantic/program.js";
import { createDiagnostic, DiagnosticCodes } from "../source/diagnostic.js";
import type { Diagnostic } from "../source/diagnostic.js";
import type { SourceRange } from "../source/document.js";
import { emitExpression } from "./expression.js";
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
    const sequence = (nodes: readonly BasicStatement[]): void => {
      for (let index = 0; index < nodes.length; index++) {
        if (index !== 0) emit(0x3a);
        const statement = nodes[index]!;
        const start = body.length;
        const sourceRange = statement.kind === "if" ? statement.headerRange : statement.range;
        if (statement.kind === "empty") { /* Empty ROM statement slot emits no opcode. */ }
        else if (statement.kind === "if") {
          emit(romTokenBySpelling("IF")!.byte);
          emitExpression(statement.condition, emit);
          emit(romTokenBySpelling("THEN")!.byte);
        } else if (statement.kind === "goto" || statement.kind === "gosub") {
          emit(romTokenBySpelling(statement.kind === "goto" ? "GO TO" : "GO SUB")!.byte);
          emitExpression(statement.target, emit);
        } else if (statement.kind === "for" || statement.kind === "next") {
          emit(romTokenBySpelling(statement.kind === "for" ? "FOR" : "NEXT")!.byte);
          for (const character of statement.variable.identity.canonicalName) emit(character.charCodeAt(0));
          if (statement.kind === "for") {
            emit(0x3d);
            emitExpression(statement.start, emit);
            emit(romTokenBySpelling("TO")!.byte);
            emitExpression(statement.limit, emit);
            if (statement.step !== undefined) { emit(romTokenBySpelling("STEP")!.byte); emitExpression(statement.step, emit); }
          }
        } else if (statement.kind === "let") {
          emit(romTokenBySpelling("LET")!.byte);
          for (const character of statement.target.identity.canonicalName) emit(character.charCodeAt(0));
          emit(0x3d);
          emitExpression(statement.expression, emit);
        } else if (statement.kind === "simple-command") emitSimpleCommand(statement, emit);
        else if (statement.kind === "input") emitInputStatement(statement, emit);
        else if (statement.kind === "print" || statement.kind === "lprint") emitPrintStatement(statement, emit);
        else emit(romTokenBySpelling(statement.kind)!.byte);
        statements.push(Object.freeze({ sourceRange, encodedRange: Object.freeze({ offset: encodedOffset + 4 + start, length: body.length - start }) }));
        if (statement.kind === "if") sequence(statement.thenStatements);
      }
    };
    sequence(line.statements);
    emit(0x0d);
    bytes.push(line.lineNumber >>> 8, line.lineNumber & 0xff, body.length & 0xff, body.length >>> 8);
    for (const byte of body) bytes.push(byte);
    lines.push(Object.freeze({ basicLineNumber: line.lineNumber, sourceRange: line.range, encodedOffset, encodedLength: body.length + 4, statements: Object.freeze(statements) }));
  }
  return Object.freeze({ sourceId: program.source.id, programBytes: Uint8Array.from(bytes), lines: Object.freeze(lines) });
}
