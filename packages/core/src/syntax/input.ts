import { createDiagnostic, DiagnosticCodes } from "../source/diagnostic.js";
import type { Diagnostic } from "../source/diagnostic.js";
import type { SourceDocument, SourceRange } from "../source/document.js";
import type { InputItem as SourceInputItem, InputStatement as SourceInputStatement } from "../source/input-items.js";
import { simpleCommandByName } from "../source/simple-commands.js";
import { parseAssignableTarget } from "./assignment.js";
import type { AssignmentTarget } from "./assignment.js";
import type { Expression } from "./expression.js";
import type { BodyToken } from "./lexer.js";
import { parsePrintStatement, readPrintItem } from "./print.js";

export type InputItem = SourceInputItem<Expression, AssignmentTarget>;
export type InputStatement = SourceInputStatement<Expression, AssignmentTarget>;
export function parseInputStatement(source: SourceDocument, input: readonly BodyToken[], range: SourceRange, diagnostics: Diagnostic[]): InputStatement {
  let tokens = input;
  let cursor = 1;
  let complete = true;
  let needItem = true;
  const items: InputItem[] = [];
  const report = (message: string): void => {
    complete = false;
    diagnostics.push(createDiagnostic({ code: DiagnosticCodes.unexpectedToken, severity: "error", category: "syntax", message, range: tokens[cursor]?.range ?? source.range(range.end) }));
  };
  const separator = (token: BodyToken | undefined): ";" | "," | "'" | undefined => token?.kind === "punctuation" && (token.text === ";" || token.text === "," || token.text === "'") ? token.text : undefined;
  if (tokens.length === 1) report("INPUT requires an item or separator.");
  while (cursor < tokens.length) {
    const token = tokens[cursor]!;
    const mark = separator(token);
    if (mark !== undefined) {
      if (needItem) items.push(Object.freeze({ kind: "input-empty", range: source.range(token.range.start) }));
      items.push(Object.freeze({ kind: "input-separator", range: token.range, separator: mark }));
      cursor++;
      needItem = true;
      continue;
    }
    if (!needItem) {
      report("Expected an INPUT item separator.");
      while (cursor < tokens.length && separator(tokens[cursor]) === undefined) cursor++;
      continue;
    }
    if (token.text === "(") {
      let depth = 1;
      let close = cursor + 1;
      while (close < tokens.length) {
        if (tokens[close]!.text === "(") depth++;
        if (tokens[close]!.text === ")" && --depth === 0) break;
        close++;
      }
      const closed = close < tokens.length;
      const innerRange = source.range(token.range.end, closed ? tokens[close]!.range.start : range.end);
      const group = parsePrintStatement(source, tokens.slice(cursor + 1, close), innerRange, diagnostics, "print", 0);
      if (!closed) { cursor = tokens.length; report("Expected ')' after INPUT display group."); }
      items.push(Object.freeze({ kind: "input-group", range: source.range(token.range.start, closed ? tokens[close]!.range.end : range.end), items: group.items, complete: closed && group.complete }));
      cursor = closed ? close + 1 : tokens.length;
    } else {
      const name = token.kind === "word" ? token.text.toUpperCase() : "";
      const romToken = token.kind === "word" ? token.romToken : undefined;
      const lineMode = name === "LINE";
      const displayPrefix = romToken?.category === "function" || romToken?.category === "value" || romToken?.category === "literal-prefix" || name === "NOT" || name === "AT" || name === "TAB" || simpleCommandByName(name)?.shape === "colour";
      if (lineMode || (token.kind === "word" && !displayPrefix)) {
        if (lineMode) cursor++;
        const start = cursor;
        let depth = 0;
        while (cursor < tokens.length) {
          const current = tokens[cursor]!;
          if (current.text === "(") depth++;
          if (current.text === ")") depth = Math.max(0, depth - 1);
          if (depth === 0 && separator(current) !== undefined) break;
          cursor++;
        }
        const targetRange = cursor === start ? source.range(tokens[cursor]?.range.start ?? range.end) : source.range(tokens[start]!.range.start, tokens[cursor - 1]!.range.end);
        const target = parseAssignableTarget(source, tokens.slice(start, cursor), targetRange, diagnostics);
        items.push(Object.freeze({ kind: "input-target", range: source.range(token.range.start, targetRange.end), target, lineMode }));
      } else {
        const printed = readPrintItem(source, tokens, cursor, range.end, diagnostics);
        tokens = printed.tokens;
        cursor = printed.next;
        if (!printed.complete) complete = false;
        items.push(Object.freeze({ kind: "input-display", range: printed.item.range, item: printed.item }));
      }
    }
    needItem = false;
  }
  if (needItem) items.push(Object.freeze({ kind: "input-empty", range: source.range(range.end) }));
  return Object.freeze({ kind: "input", range, items: Object.freeze(items), complete });
}
