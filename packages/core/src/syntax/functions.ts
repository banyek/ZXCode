import { createDiagnostic, DiagnosticCodes } from "../source/diagnostic.js";
import type { Diagnostic } from "../source/diagnostic.js";
import type { SourceDocument, SourceRange } from "../source/document.js";
import { readExpression } from "./expression.js";
import type { Expression } from "./expression.js";
import { readFunctionName } from "./function-name.js";
import type { FunctionName } from "./function-name.js";
import type { BodyToken } from "./lexer.js";

export interface DefFnStatement {
  readonly kind: "def-fn";
  readonly range: SourceRange;
  readonly name: FunctionName;
  readonly parameters: readonly FunctionName[];
  readonly body: Expression;
  readonly complete: boolean;
}
export function parseDefFnStatement(source: SourceDocument, input: readonly BodyToken[], range: SourceRange, diagnostics: Diagnostic[]): DefFnStatement {
  let tokens = input;
  let cursor = 1;
  let complete = true;
  const expect = (text: string): boolean => {
    if (tokens[cursor]?.text.toUpperCase() === text) { cursor++; return true; }
    diagnostics.push(createDiagnostic({ code: DiagnosticCodes.unexpectedToken, severity: "error", category: "syntax", message: `Expected '${text}' in DEF FN.`, range: source.range(tokens[cursor]?.range.start ?? range.end) }));
    complete = false;
    return false;
  };
  expect("FN");
  const named = readFunctionName(source, tokens, cursor, range.end, "function", diagnostics);
  cursor = named.next;
  const parameters: FunctionName[] = [];
  if (expect("(") && tokens[cursor]?.text !== ")") {
    while (true) {
      const parsed = readFunctionName(source, tokens, cursor, range.end, "formal", diagnostics);
      parameters.push(parsed.name);
      cursor = parsed.next;
      if (tokens[cursor]?.text !== ",") break;
      cursor++;
    }
  }
  expect(")");
  expect("=");
  const parsed = readExpression(source, tokens, cursor, range.end, diagnostics);
  tokens = parsed.tokens;
  if (parsed.next !== tokens.length) {
    complete = false;
    diagnostics.push(createDiagnostic({ code: DiagnosticCodes.unexpectedToken, severity: "error", category: "syntax", message: "Unexpected token after DEF FN body.", range: tokens[parsed.next]!.range }));
  }
  complete = complete && named.name.identity !== undefined && parameters.every((item) => item.identity !== undefined);
  return Object.freeze({ kind: "def-fn", range, name: named.name, parameters: Object.freeze(parameters), body: parsed.expression, complete });
}
