import { createDiagnostic, DiagnosticCodes } from "../source/diagnostic.js";
import type { Diagnostic } from "../source/diagnostic.js";
import type { SourceDocument, SourceRange } from "../source/document.js";
import { simpleCommandByName } from "../source/simple-commands.js";
import type { ColourControl, SimpleCommandStatement } from "../source/simple-commands.js";
import type { BodyToken } from "./lexer.js";
import { readExpression } from "./expression.js";
import type { Expression } from "./expression.js";

/** ROM simple classes plus explicit graphics prefix/tail grammar, never class-05 lists. */
export function parseSimpleCommand(source: SourceDocument, input: readonly BodyToken[], range: SourceRange, diagnostics: Diagnostic[]): SimpleCommandStatement<Expression> | undefined {
  let tokens = input;
  const name = tokens[0]!.text.toUpperCase();
  const hashCommand = name === "OPEN" || name === "CLOSE";
  const definition = simpleCommandByName(hashCommand ? `${name} #` : name);
  if (definition === undefined) return undefined;
  let cursor = 1;
  let complete = true;
  const operands: Expression[] = [];
  const controls: ColourControl<Expression>[] = [];
  const report = (message: string): void => {
    complete = false;
    diagnostics.push(createDiagnostic({ code: DiagnosticCodes.unexpectedToken, severity: "error", category: "syntax", message, range: tokens[cursor]?.range ?? source.range(range.end) }));
  };
  const expect = (separator: string): void => {
    if (tokens[cursor]?.text === separator) cursor++;
    else report(`Expected '${separator}' in ${definition.token.spelling}.`);
  };
  const expression = (): Expression => {
    const parsed = readExpression(source, tokens, cursor, range.end, diagnostics);
    tokens = parsed.tokens;
    cursor = parsed.next;
    return parsed.expression;
  };
  if (hashCommand) expect("#");
  const shape = definition.shape;
  if (shape === "plot" || shape === "draw" || shape === "circle") {
    while (true) {
      const control = simpleCommandByName(tokens[cursor]?.text.toUpperCase() ?? "");
      if (control?.shape !== "colour") break;
      const start = tokens[cursor++]!.range.start;
      const value = expression();
      const separator = tokens[cursor]?.text;
      if (separator !== ";" && separator !== ",") { report("Expected ',' or ';' after graphics colour control."); break; }
      const end = tokens[cursor++]!.range.end;
      controls.push(Object.freeze({ token: control.token, expression: value, separator, range: source.range(start, end) }));
    }
    operands.push(expression());
    expect(",");
    operands.push(expression());
    if (shape === "circle" || (shape === "draw" && tokens[cursor]?.text === ",")) {
      expect(",");
      operands.push(expression());
    }
  } else if (shape !== "none" && (shape !== "optional-number" || cursor < tokens.length)) {
    operands.push(expression());
    if (shape === "number-pair" || shape === "string-pair" || shape === "open") {
      expect(",");
      operands.push(expression());
    }
  }
  if (cursor < tokens.length) report(`Unexpected operand/token after ${definition.token.spelling}.`);
  return Object.freeze({ kind: "simple-command", range, definition, operands: Object.freeze(operands), controls: Object.freeze(controls), complete });
}
