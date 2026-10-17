import { createDiagnostic, DiagnosticCodes } from "../source/diagnostic.js";
import type { Diagnostic } from "../source/diagnostic.js";
import type { SourceDocument, SourceRange } from "../source/document.js";
import type { PrintContentItem, PrintItem, PrintStatement } from "../source/print-items.js";
import { simpleCommandByName } from "../source/simple-commands.js";
import type { BodyToken } from "./lexer.js";
import { readExpression } from "./expression.js";
import type { Expression } from "./expression.js";

export function parsePrintStatement(source: SourceDocument, input: readonly BodyToken[], range: SourceRange, diagnostics: Diagnostic[], kind: "print" | "lprint", startIndex = 1): PrintStatement<Expression> {
  let tokens = input;
  let cursor = startIndex;
  let complete = true;
  let needItem = true;
  const items: PrintItem<Expression>[] = [];
  const report = (message: string): void => {
    complete = false;
    diagnostics.push(createDiagnostic({ code: DiagnosticCodes.unexpectedToken, severity: "error", category: "syntax", message, range: tokens[cursor]?.range ?? source.range(range.end) }));
  };
  const separator = (token: BodyToken | undefined): ";" | "," | "'" | undefined => token?.kind === "punctuation" && (token.text === ";" || token.text === "," || token.text === "'") ? token.text : undefined;
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
    const parsed = readPrintItem(source, tokens, cursor, range.end, diagnostics);
    tokens = parsed.tokens;
    cursor = parsed.next;
    items.push(parsed.item);
    if (!parsed.complete) complete = false;
    needItem = false;
  }
  if (needItem) items.push(Object.freeze({ kind: "print-empty", range: source.range(range.end) }));
  return Object.freeze({ kind, range, items: Object.freeze(items), complete });
}

/** Read one display item; PRINT and INPUT retain their own surrounding streams. */
export function readPrintItem(source: SourceDocument, input: readonly BodyToken[], start: number, end: number, diagnostics: Diagnostic[]): { readonly item: PrintContentItem<Expression>; readonly tokens: readonly BodyToken[]; readonly next: number; readonly complete: boolean } {
  let tokens = input;
  let cursor = start;
  let complete = true;
  const token = tokens[cursor]!;
  const name = token.kind === "word" ? token.text.toUpperCase() : "";
  const control = simpleCommandByName(name);
  const expression = (): Expression => {
    const parsed = readExpression(source, tokens, cursor, end, diagnostics);
    tokens = parsed.tokens;
    cursor = parsed.next;
    return parsed.expression;
  };
  let item: PrintContentItem<Expression>;
  if (name === "AT") {
    cursor++;
    const row = expression();
    const comma = tokens[cursor]?.text === ",";
    if (comma) cursor++;
    else {
      complete = false;
      diagnostics.push(createDiagnostic({ code: DiagnosticCodes.unexpectedToken, severity: "error", category: "syntax", message: "Expected ',' between AT row and column.", range: tokens[cursor]?.range ?? source.range(end) }));
    }
    const column = expression();
    item = Object.freeze({ kind: "print-at", range: source.range(token.range.start, column.range.end), row, column, complete: comma });
  } else if (name === "TAB") {
    cursor++;
    const column = expression();
    item = Object.freeze({ kind: "print-tab", range: source.range(token.range.start, column.range.end), column });
  } else if (control?.shape === "colour") {
    cursor++;
    const value = expression();
    item = Object.freeze({ kind: "print-control", range: source.range(token.range.start, value.range.end), token: control.token, expression: value });
  } else if (token.text === "#") {
    cursor++;
    const stream = expression();
    item = Object.freeze({ kind: "print-channel", range: source.range(token.range.start, stream.range.end), stream });
  } else {
    const value = expression();
    item = Object.freeze({ kind: "print-expression", range: value.range, expression: value });
  }
  return Object.freeze({ item, tokens, next: cursor, complete });
}
