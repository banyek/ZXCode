import { createDiagnostic, DiagnosticCodes } from "../source/diagnostic.js";
import type { Diagnostic } from "../source/diagnostic.js";
import type { SourceDocument, SourceRange } from "../source/document.js";
import { parseAssignableTarget } from "./assignment.js";
import type { AssignmentTarget } from "./assignment.js";
import { readExpression } from "./expression.js";
import type { Expression } from "./expression.js";
import type { BodyToken } from "./lexer.js";

export interface DataStatement {
  readonly kind: "data";
  readonly range: SourceRange;
  readonly items: readonly Expression[];
  readonly commaRanges: readonly SourceRange[];
  readonly complete: boolean;
}
export interface ReadStatement {
  readonly kind: "read";
  readonly range: SourceRange;
  readonly targets: readonly AssignmentTarget[];
  readonly commaRanges: readonly SourceRange[];
  readonly complete: boolean;
}

export function parseDataStatement(source: SourceDocument, input: readonly BodyToken[], range: SourceRange, diagnostics: Diagnostic[]): DataStatement {
  let tokens = input;
  let cursor = 1;
  let complete = true;
  const items: Expression[] = [];
  const commaRanges: SourceRange[] = [];
  while (true) {
    const parsed = readExpression(source, tokens, cursor, range.end, diagnostics);
    items.push(parsed.expression);
    tokens = parsed.tokens;
    cursor = parsed.next;
    if (parsed.expression.kind === "error-expression") complete = false;
    if (cursor === tokens.length) break;
    if (tokens[cursor]!.text !== ",") {
      complete = false;
      diagnostics.push(createDiagnostic({ code: DiagnosticCodes.unexpectedToken, severity: "error", category: "syntax", message: "Expected comma between DATA expressions.", range: tokens[cursor]!.range }));
      while (cursor < tokens.length && tokens[cursor]!.text !== ",") cursor++;
      if (cursor === tokens.length) break;
    }
    commaRanges.push(tokens[cursor++]!.range);
  }
  return Object.freeze({ kind: "data", range, items: Object.freeze(items), commaRanges: Object.freeze(commaRanges), complete });
}

export function parseReadStatement(source: SourceDocument, tokens: readonly BodyToken[], range: SourceRange, diagnostics: Diagnostic[]): ReadStatement {
  const targets: AssignmentTarget[] = [];
  const commaRanges: SourceRange[] = [];
  let cursor = 1;
  let complete = true;
  while (true) {
    const start = cursor;
    let depth = 0;
    while (cursor < tokens.length) {
      const text = tokens[cursor]!.text;
      if (text === "," && depth === 0) break;
      if (text === "(") depth++;
      else if (text === ")" && depth > 0) depth--;
      cursor++;
    }
    const targetRange = source.range(tokens[start]?.range.start ?? range.end, cursor > start ? tokens[cursor - 1]!.range.end : tokens[start]?.range.start ?? range.end);
    const target = parseAssignableTarget(source, tokens.slice(start, cursor), targetRange, diagnostics);
    targets.push(target);
    if (target.kind === "error-target") complete = false;
    if (cursor === tokens.length) break;
    commaRanges.push(tokens[cursor++]!.range);
  }
  return Object.freeze({ kind: "read", range, targets: Object.freeze(targets), commaRanges: Object.freeze(commaRanges), complete });
}
