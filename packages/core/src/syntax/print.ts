import { createDiagnostic, DiagnosticCodes } from "../source/diagnostic.js";
import type { Diagnostic } from "../source/diagnostic.js";
import type { SourceDocument, SourceRange } from "../source/document.js";
import type { PrintItem, PrintStatement } from "../source/print-items.js";
import { simpleCommandByName } from "../source/simple-commands.js";
import type { BodyToken } from "./lexer.js";
import { readExpression } from "./expression.js";
import type { Expression } from "./expression.js";

export function parsePrintStatement(source: SourceDocument, input: readonly BodyToken[], range: SourceRange, diagnostics: Diagnostic[], kind: "print" | "lprint"): PrintStatement<Expression> {
  let tokens = input;
  let cursor = 1;
  let complete = true;
  let needItem = true;
  const items: PrintItem<Expression>[] = [];
  const report = (message: string): void => {
    complete = false;
    diagnostics.push(createDiagnostic({ code: DiagnosticCodes.unexpectedToken, severity: "error", category: "syntax", message, range: tokens[cursor]?.range ?? source.range(range.end) }));
  };
  const separator = (token: BodyToken | undefined): ";" | "," | "'" | undefined => token?.kind === "punctuation" && (token.text === ";" || token.text === "," || token.text === "'") ? token.text : undefined;
  const expression = (): Expression => {
    const result = readExpression(source, tokens, cursor, range.end, diagnostics);
    tokens = result.tokens;
    cursor = result.next;
    return result.expression;
  };
  while (cursor < tokens.length) {
    const token = tokens[cursor]!;
    const mark = separator(token);
    if (mark !== undefined) {
      if (needItem) items.push(Object.freeze({ kind: "print-empty", range: source.range(token.range.start) }));
      items.push(Object.freeze({ kind: "print-separator", range: token.range, separator: mark }));
      cursor++;
      needItem = true;
      continue;
    }
    if (!needItem) {
      report("Expected a PRINT item separator: ';', ',' or apostrophe.");
      while (cursor < tokens.length && separator(tokens[cursor]) === undefined) cursor++;
      continue;
    }
    const name = token.kind === "word" ? token.text.toUpperCase() : "";
    const control = simpleCommandByName(name);
    if (name === "AT") {
      cursor++;
      const row = expression();
      const comma = tokens[cursor]?.text === ",";
      if (comma) cursor++;
      else report("Expected ',' between AT row and column.");
      const column = expression();
      items.push(Object.freeze({ kind: "print-at", range: source.range(token.range.start, column.range.end), row, column, complete: comma }));
    } else if (name === "TAB") {
      cursor++;
      const column = expression();
      items.push(Object.freeze({ kind: "print-tab", range: source.range(token.range.start, column.range.end), column }));
    } else if (control?.shape === "colour") {
      cursor++;
      const value = expression();
      items.push(Object.freeze({ kind: "print-control", range: source.range(token.range.start, value.range.end), token: control.token, expression: value }));
    } else if (token.text === "#") {
      cursor++;
      const stream = expression();
      items.push(Object.freeze({ kind: "print-channel", range: source.range(token.range.start, stream.range.end), stream }));
    } else {
      const value = expression();
      items.push(Object.freeze({ kind: "print-expression", range: value.range, expression: value }));
    }
    needItem = false;
  }
  if (needItem) items.push(Object.freeze({ kind: "print-empty", range: source.range(range.end) }));
  return Object.freeze({ kind, range, items: Object.freeze(items), complete });
}
