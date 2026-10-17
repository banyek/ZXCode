import { parseForStatement, parseNextStatement } from "./loops.js";
import type { ForStatement, NextStatement } from "./loops.js";
import { parseLetStatement } from "./assignment.js";
import type { LetStatement } from "./assignment.js";
import { parseSimpleCommand } from "./simple-commands.js";
import type { SimpleCommandStatement } from "../source/simple-commands.js";
import { createDiagnostic, DiagnosticCodes } from "../source/diagnostic.js";
import type { Diagnostic } from "../source/diagnostic.js";
import type { SourceDocument, SourceRange } from "../source/document.js";
import { lexBody } from "./lexer.js";
import type { BodyToken } from "./lexer.js";
import { scanPhysicalLines } from "./physical-lines.js";
import type { BlankPhysicalLine, InvalidPhysicalLine, NumberedPhysicalLine } from "./physical-lines.js";
import type { ParsedDocument } from "./document.js";

import { readExpression } from "./expression.js";
import type { Expression } from "./expression.js";
export type { LiteralExpression } from "./expression.js";

export type PrintItem =
  | { readonly kind: "print-expression"; readonly range: SourceRange; readonly expression: Expression }
  | { readonly kind: "print-separator"; readonly range: SourceRange; readonly separator: ";" | "," };

export interface IfStatement {
  readonly kind: "if";
  readonly range: SourceRange;
  readonly headerRange: SourceRange;
  readonly condition: Expression;
  readonly thenStatements: readonly Statement[];
  readonly complete: boolean;
}
export interface JumpStatement {
  readonly kind: "goto" | "gosub";
  readonly range: SourceRange;
  readonly target: Expression;
  readonly complete: boolean;
}
export type Statement = ForStatement | NextStatement | IfStatement | JumpStatement | LetStatement | SimpleCommandStatement<Expression>
  | { readonly kind: "empty"; readonly range: SourceRange }
  | { readonly kind: "print"; readonly range: SourceRange; readonly items: readonly PrintItem[] }
  | { readonly kind: "cls" | "stop"; readonly range: SourceRange }
  | { readonly kind: "error-statement"; readonly range: SourceRange; readonly tokens: readonly BodyToken[] };

export interface NumberedSyntaxLine extends NumberedPhysicalLine {
  readonly tokens: readonly BodyToken[];
  readonly statements: readonly Statement[];
}

export type BasicSyntaxLine = NumberedSyntaxLine | BlankPhysicalLine | InvalidPhysicalLine;
export interface BasicSyntaxProgram {
  readonly kind: "basic-program";
  readonly lines: readonly BasicSyntaxLine[];
}

function parseStatement(source: SourceDocument, tokens: readonly BodyToken[], range: SourceRange, diagnostics: Diagnostic[]): Statement {
  const fail = (message: string, syntax = false): Statement => {
    diagnostics.push(createDiagnostic({ code: syntax ? DiagnosticCodes.unexpectedToken : DiagnosticCodes.unsupportedSyntax, severity: "error", category: syntax ? "syntax" : "compatibility", message, range }));
    return Object.freeze({ kind: "error-statement", range, tokens: Object.freeze([...tokens]) });
  };
  const command = tokens[0];
  if (command?.kind !== "word") return fail("Expected a BASIC statement command.", true);
  const keyword = command.text.toUpperCase();
  if (keyword === "CLS" || keyword === "STOP") {
    if (tokens.length !== 1) return fail(`${keyword} does not accept operands.`, true);
    return Object.freeze({ kind: keyword === "CLS" ? "cls" : "stop", range });
  }
  if (keyword === "GO") {
    const direction = tokens[1]?.text.toUpperCase();
    if (direction !== "TO" && direction !== "SUB") return fail("Expected TO or SUB after GO.", true);
    const parsed = readExpression(source, tokens, 2, range.end, diagnostics);
    const complete = parsed.next === parsed.tokens.length;
    if (!complete) diagnostics.push(createDiagnostic({ code: DiagnosticCodes.unexpectedToken, severity: "error", category: "syntax", message: "Unexpected token after jump target expression.", range: parsed.tokens[parsed.next]!.range }));
    return Object.freeze({ kind: direction === "TO" ? "goto" : "gosub", range, target: parsed.expression, complete });
  }
  if (keyword === "FOR") return parseForStatement(source, tokens, range, diagnostics);
  if (keyword === "NEXT") return parseNextStatement(source, tokens, range, diagnostics);
  if (keyword === "LET") return parseLetStatement(source, tokens, range, diagnostics);
  const simple = parseSimpleCommand(source, tokens, range, diagnostics);
  if (simple !== undefined) return simple;
  if (keyword !== "PRINT") return fail("This statement grammar is not implemented yet.");
  const items: PrintItem[] = [];
  let cursor = 1;
  while (cursor < tokens.length) {
    const parsed = readExpression(source, tokens, cursor, range.end, diagnostics);
    const expression = parsed.expression;
    items.push(Object.freeze({ kind: "print-expression", range: expression.range, expression }));
    cursor = parsed.next;
    tokens = parsed.tokens;
    if (cursor < tokens.length) {
      const separator = tokens[cursor]!;
      if (separator.kind !== "punctuation" || (separator.text !== ";" && separator.text !== ",")) {
        return fail("Expected a PRINT separator after expression.");
      }
      items.push(Object.freeze({ kind: "print-separator", range: separator.range, separator: separator.text }));
      cursor++;
    }
  }
  return Object.freeze({ kind: "print", range, items: Object.freeze(items) });
}

/** IF owns the entire remainder; colons remain statement slots inside that scope. */
function parseSequence(source: SourceDocument, tokens: readonly BodyToken[], range: SourceRange, diagnostics: Diagnostic[], depth = 0, allowEmpty = false): readonly Statement[] {
  if (depth >= 127) {
    diagnostics.push(createDiagnostic({ code: DiagnosticCodes.tooManyStatements, severity: "error", category: "compatibility", message: "The 48K ROM supports at most 127 statements in one BASIC line.", range }));
    return Object.freeze([Object.freeze({ kind: "error-statement", range, tokens: Object.freeze([...tokens]) })]);
  }
  if (tokens.length === 0) return Object.freeze(allowEmpty ? [Object.freeze({ kind: "empty", range: source.range(range.end) })] : []);
  const statements: Statement[] = [];
  let start = 0;
  let insertion = range.start;
  while (start <= tokens.length) {
    const first = tokens[start];
    if (first?.kind === "word" && first.text.toUpperCase() === "IF") {
      const parsed = readExpression(source, tokens, start + 1, range.end, diagnostics);
      tokens = parsed.tokens;
      const then = tokens[parsed.next];
      const complete = then?.kind === "word" && then.text.toUpperCase() === "THEN";
      let tailStart = parsed.next + 1;
      if (!complete) {
        diagnostics.push(createDiagnostic({ code: DiagnosticCodes.unexpectedToken, severity: "error", category: "syntax", message: "Expected THEN after IF condition.", range: source.range(then?.range.start ?? range.end) }));
        const colon = tokens.findIndex((token, index) => index >= parsed.next && token.kind === "colon");
        tailStart = colon < 0 ? tokens.length : colon + 1;
      }
      const headerEnd = complete ? then.range.end : parsed.expression.range.end;
      const tailInsertion = tokens[tailStart]?.range.start ?? range.end;
      const tail = parseSequence(source, tokens.slice(tailStart), source.range(tailInsertion, range.end), diagnostics, depth + 1, true);
      statements.push(Object.freeze({ kind: "if", range: source.range(first.range.start, range.end), headerRange: source.range(first.range.start, headerEnd), condition: parsed.expression, thenStatements: tail, complete }));
      break;
    }
    let end = start;
    while (end < tokens.length && tokens[end]!.kind !== "colon") end++;
    const group = tokens.slice(start, end);
    const statementRange = group.length === 0 ? source.range(insertion) : source.range(group[0]!.range.start, group[group.length - 1]!.range.end);
    statements.push(group.length === 0 ? Object.freeze({ kind: "empty", range: statementRange }) : parseStatement(source, group, statementRange, diagnostics));
    if (end === tokens.length) break;
    insertion = tokens[end]!.range.end;
    start = end + 1;
  }
  return Object.freeze(statements);
}

/** Recoverable CST/statement parsing on the same path used by builds. */
export function parseBasic(source: SourceDocument): ParsedDocument<BasicSyntaxProgram> {
  const physical = scanPhysicalLines(source);
  const diagnostics = [...physical.diagnostics];
  const lines: BasicSyntaxLine[] = [];
  for (const line of physical.syntax.lines) {
    if (line.kind !== "numbered") { lines.push(line); continue; }
    const lexed = lexBody(source, line.bodyRange);
    diagnostics.push(...lexed.diagnostics);
    const significant = lexed.tokens.filter((token) => token.kind !== "whitespace" && token.kind !== "eof");
    const statements = parseSequence(source, significant, line.bodyRange, diagnostics);
    lines.push(Object.freeze({ ...line, tokens: lexed.tokens, statements }));
  }
  return Object.freeze({ source, syntax: Object.freeze({ kind: "basic-program", lines: Object.freeze(lines) }), diagnostics: Object.freeze(diagnostics) });
}
