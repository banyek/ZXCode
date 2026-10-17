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

export type Statement = LetStatement | SimpleCommandStatement<Expression>
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
  if (command?.kind !== "word") return fail("Expected an M1 statement; empty/other statement forms are not supported yet.");
  const keyword = command.text.toUpperCase();
  if (keyword === "CLS" || keyword === "STOP") {
    if (tokens.length !== 1) return fail(`${keyword} does not accept operands.`, true);
    return Object.freeze({ kind: keyword === "CLS" ? "cls" : "stop", range });
  }
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

/** Recoverable CST/statement parsing on the same path used by future builds. */
export function parseBasic(source: SourceDocument): ParsedDocument<BasicSyntaxProgram> {
  const physical = scanPhysicalLines(source);
  const diagnostics = [...physical.diagnostics];
  const lines: BasicSyntaxLine[] = [];
  for (const line of physical.syntax.lines) {
    if (line.kind !== "numbered") {
      lines.push(line);
      continue;
    }
    const lexed = lexBody(source, line.bodyRange);
    diagnostics.push(...lexed.diagnostics);
    const statements: Statement[] = [];
    let group: BodyToken[] = [];
    let insertion = line.bodyRange.start;
    let separatorSeen = false;
    const flush = (): void => {
      const range = group.length === 0 ? source.range(insertion)
        : source.range(group[0]!.range.start, group[group.length - 1]!.range.end);
      statements.push(parseStatement(source, group, range, diagnostics));
      group = [];
    };
    for (const token of lexed.tokens) {
      if (token.kind === "whitespace" || token.kind === "eof") continue;
      if (token.kind === "colon") {
        flush();
        insertion = token.range.end;
        separatorSeen = true;
      } else group.push(token);
    }
    if (group.length !== 0 || separatorSeen) flush();
    lines.push(Object.freeze({ ...line, tokens: lexed.tokens, statements: Object.freeze(statements) }));
  }
  return Object.freeze({ source, syntax: Object.freeze({ kind: "basic-program", lines: Object.freeze(lines) }), diagnostics: Object.freeze(diagnostics) });
}
