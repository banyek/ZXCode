import { readFunctionName } from "./function-name.js";
import type { FunctionName } from "./function-name.js";
import type { AccessGroup, AccessSelector } from "../source/access.js";
import { identifyVariable } from "../source/variable-identity.js";
import type { VariableIdentity } from "../source/variable-identity.js";
import { createDiagnostic, DiagnosticCodes } from "../source/diagnostic.js";
import type { Diagnostic } from "../source/diagnostic.js";
import type { SourceDocument, SourceRange } from "../source/document.js";
import type { RomToken } from "../source/rom-tokens.js";
import { lexBody } from "./lexer.js";
import type { BodyToken, StringPart } from "./lexer.js";
import type { ParsedDocument } from "./document.js";

export type LiteralExpression =
  | { readonly kind: "string-literal"; readonly range: SourceRange; readonly contentRange: SourceRange; readonly value: string | undefined; readonly parts: readonly StringPart[]; readonly closed: boolean }
  | { readonly kind: "numeric-literal"; readonly range: SourceRange; readonly lexeme: string };

export type Expression = LiteralExpression
  | { readonly kind: "user-function-call"; readonly range: SourceRange; readonly name: FunctionName; readonly arguments: readonly Expression[]; readonly complete: boolean }
  | { readonly kind: "access-expression"; readonly range: SourceRange; readonly base: Expression; readonly group: AccessGroup<Expression> }
  | { readonly kind: "binary-literal"; readonly range: SourceRange; readonly digitsRange: SourceRange; readonly lexeme: string }
  | { readonly kind: "name-expression"; readonly range: SourceRange; readonly spelling: string; readonly identity: VariableIdentity }
  | { readonly kind: "builtin-value"; readonly range: SourceRange; readonly token: RomToken }
  | { readonly kind: "builtin-call"; readonly range: SourceRange; readonly token: RomToken; readonly arguments: readonly Expression[]; readonly closed: boolean }
  | { readonly kind: "unary-expression"; readonly range: SourceRange; readonly operatorRange: SourceRange; readonly operator: "+" | "-" | "NOT"; readonly operand: Expression }
  | { readonly kind: "binary-expression"; readonly range: SourceRange; readonly operatorRange: SourceRange; readonly operator: string; readonly left: Expression; readonly right: Expression }
  | { readonly kind: "parenthesized-expression"; readonly range: SourceRange; readonly expression: Expression; readonly closed: boolean }
  | { readonly kind: "error-expression"; readonly range: SourceRange; readonly tokens: readonly BodyToken[] };

const priorities: ReadonlyMap<string, number> = new Map([
  ["OR", 2], ["AND", 3], ["<=", 5], [">=", 5], ["<>", 5], [">", 5], ["<", 5], ["=", 5],
  ["+", 6], ["-", 6], ["*", 8], ["/", 8], ["^", 10]
]);
const boundaries = new Set([",", ";", ")", ":", "THEN", "TO", "STEP"]);

/** Consume one expression, leaving the caller's item/statement delimiter untouched. */
export function readExpression(source: SourceDocument, inputTokens: readonly BodyToken[], start: number, end: number, diagnostics: Diagnostic[], initialDepth = 0, nameBoundaries?: ReadonlySet<string>): { readonly expression: Expression; readonly next: number; readonly tokens: readonly BodyToken[] } {
  let tokens = [...inputTokens];
  let cursor = start;
  const peek = (): BodyToken | undefined => tokens[cursor];
  const spelling = (): string => peek()?.text.toUpperCase() ?? "";
  const position = (): number => peek()?.range.start ?? end;
  const span = (from: number, through = from): SourceRange => source.range(from, Math.max(through, cursor > start ? tokens[cursor - 1]!.range.end : from));
  const report = (message: string, range: SourceRange, tooling = false): void => {
    diagnostics.push(createDiagnostic({ code: tooling ? DiagnosticCodes.unsupportedSyntax : DiagnosticCodes.unexpectedToken, severity: "error", category: tooling ? "tooling" : "syntax", message, range }));
  };
  const expect = (text: string): boolean => {
    if (spelling() === text) { cursor++; return true; }
    report(`Expected '${text}' in expression.`, source.range(position()));
    return false;
  };
  const error = (message: string, consume: boolean, tooling = false): Expression => {
    const token = peek();
    const range = consume && token !== undefined ? token.range : source.range(position());
    const retained = consume && token !== undefined ? [token] : [];
    if (retained.length !== 0) cursor++;
    report(message, range, tooling);
    return Object.freeze({ kind: "error-expression", range, tokens: Object.freeze(retained) });
  };
  const postfix = (base: Expression, depth: number): Expression => {
    while (tokens[cursor]?.text === "(") {
      const parsed = readAccessGroup(source, tokens, cursor, end, diagnostics, depth + 1);
      if (parsed.tokens !== tokens) tokens = [...parsed.tokens];
      cursor = parsed.next;
      base = Object.freeze({ kind: "access-expression", range: source.range(base.range.start, parsed.group.range.end), base, group: parsed.group });
    }
    return base;
  };
  const prefix = (depth: number): Expression => {
    const token = peek();
    const text = spelling();
    if (token === undefined || boundaries.has(text)) return error("Expected an expression.", false);
    if (depth >= 256) return error("Expression exceeds the supported 256-level nesting budget.", true, true);
    cursor++;
    if (token.kind === "string") return postfix(Object.freeze({ kind: "string-literal", range: token.range, contentRange: token.contentRange, value: token.value, parts: token.parts, closed: token.closed }), depth);
    if (token.kind === "number") {
      const lexeme = token.text.replace(/[ \t]/g, "");
      if (/[Ee][+-]?$/.test(lexeme)) diagnostics.push(createDiagnostic({ code: DiagnosticCodes.invalidNumericLiteral, severity: "error", category: "syntax", message: "Expected decimal exponent digits.", range: token.range }));
      return postfix(Object.freeze({ kind: "numeric-literal", range: token.range, lexeme }), depth);
    }
    if (text === "(") {
      const expression = binary(0, depth + 1);
      const closed = expect(")");
      return postfix(Object.freeze({ kind: "parenthesized-expression", range: span(token.range.start, closed ? expression.range.end : position()), expression, closed }), depth);
    }
    if (text === "+" || text === "-" || text === "NOT") {
      const operand = text === "+" ? prefix(depth + 1) : binary(text === "-" ? 9 : 4, depth + 1);
      return Object.freeze({ kind: "unary-expression", range: source.range(token.range.start, operand.range.end), operatorRange: token.range, operator: text, operand });
    }
    const romToken = token.kind === "word" ? token.romToken : undefined;
    if (romToken?.category === "value") return postfix(Object.freeze({ kind: "builtin-value", range: token.range, token: romToken }), depth);
    if (text === "BIN") {
      const digitsStart = position();
      let lexeme = "";
      let digitsEnd = digitsStart;
      while (peek()?.kind === "number" && /^[01]+$/.test(peek()!.text)) {
        lexeme += peek()!.text;
        digitsEnd = tokens[cursor++]!.range.end;
      }
      return postfix(Object.freeze({ kind: "binary-literal", range: span(token.range.start), digitsRange: source.range(digitsStart, digitsEnd), lexeme }), depth);
    }
    if (text === "FN") {
      const named = readFunctionName(source, tokens, cursor, end, "function", diagnostics);
      cursor = named.next;
      const args: Expression[] = [];
      const opened = expect("(");
      if (opened && spelling() !== ")") {
        while (true) {
          args.push(binary(0, depth + 1));
          if (spelling() !== ",") break;
          cursor++;
        }
      }
      const complete = expect(")") && opened && named.name.identity !== undefined;
      return postfix(Object.freeze({ kind: "user-function-call", range: span(token.range.start), name: named.name, arguments: Object.freeze(args), complete }), depth);
    }
    if (romToken?.category === "function" && text !== "FN") {
      const args: Expression[] = [];
      let closed = true;
      if (text === "POINT" || text === "ATTR" || text === "SCREEN$") {
        const opened = expect("(");
        args.push(binary(0, depth + 1));
        const separated = expect(",");
        args.push(binary(0, depth + 1));
        closed = expect(")") && opened && separated;
      } else args.push(binary(16, depth + 1));
      const call: Expression = Object.freeze({ kind: "builtin-call", range: span(token.range.start, Math.max(...args.map((arg) => arg.range.end), closed ? token.range.end : position())), token: romToken, arguments: Object.freeze(args), closed });
      return text === "POINT" || text === "ATTR" || text === "SCREEN$" ? postfix(call, depth) : call;
    }
    if (token.kind === "word" && romToken?.category !== "print-control" && text !== "FN" && text !== "AND" && text !== "OR") {
      let offset = token.range.start;
      let nameEnd = offset;
      let index = cursor - 1;
      const delimiters = new Set(["AND", "OR", "THEN", "TO", "STEP", ...(nameBoundaries ?? [])]);
      while (offset < end) {
        while (tokens[index] !== undefined && tokens[index]!.range.end <= offset) index++;
        const candidate = tokens[index];
        if (offset > token.range.start && candidate?.range.start === offset && delimiters.has(candidate.text.toUpperCase())) break;
        const character = source.text[offset]!;
        if (/[A-Za-z0-9]/.test(character)) { nameEnd = ++offset; continue; }
        if (character === " " || character === "\t") { offset++; continue; }
        if (character === "$") nameEnd = offset + 1;
        break;
      }
      cursor--; // Consume the raw name boundary, not a provisional decimal token.
      while (tokens[cursor] !== undefined && tokens[cursor]!.range.end <= nameEnd) cursor++;
      const partial = tokens[cursor];
      if (partial !== undefined && partial.range.start < nameEnd) {
        // A name may end inside a provisional exponent token. Relex the rest
        // so its new numeric start can consume a following fraction/exponent.
        // Preserve an existing REM raw tail instead of guessing statement state.
        const rawTail = tokens.findIndex((item, index) => index >= cursor && item.kind === "raw-tail");
        const retained = rawTail < 0 ? [] : tokens.slice(rawTail);
        const remainderEnd = rawTail < 0 ? tokens[tokens.length - 1]!.range.end : tokens[rawTail]!.range.start;
        const remainder = lexBody(source, source.range(nameEnd, remainderEnd)).tokens.filter((item) => item.kind !== "eof" && item.kind !== "whitespace");
        tokens.splice(cursor, tokens.length - cursor, ...remainder, ...retained);
      }
      const range = source.range(token.range.start, nameEnd);
      const name = source.textInRange(range);
      const result = identifyVariable(name, name.endsWith("$") ? "string-scalar" : "numeric-scalar");
      if (result.kind === "error") {
        diagnostics.push(createDiagnostic({ code: DiagnosticCodes.invalidVariableName, severity: "error", category: "syntax", message: "String variable names must be one letter followed by '$'.", range }));
        return Object.freeze({ kind: "error-expression", range, tokens: Object.freeze(inputTokens.filter((item) => item.range.start >= range.start && item.range.end <= range.end)) });
      }
      return postfix(Object.freeze({ kind: "name-expression", range, spelling: name, identity: result.identity }), depth);
    }
    cursor--; // Keep the unexpected token in an error node.
    return error("Expected a supported expression primary or prefix.", true);
  };
  const binary = (minimum: number, depth: number): Expression => {
    let left = prefix(depth);
    while (true) {
      const operator = spelling();
      const priority = priorities.get(operator);
      if (priority === undefined || priority < minimum) return left;
      const operatorRange = tokens[cursor++]!.range;
      const right = binary(priority + 1, depth + 1); // ROM reduces equal priorities immediately.
      left = Object.freeze({ kind: "binary-expression", range: source.range(left.range.start, right.range.end), operatorRange, operator, left, right });
    }
  };
  const expression = binary(0, initialDepth);
  return Object.freeze({ expression, next: cursor, tokens: Object.freeze(tokens) });
}

/** Standalone expression entry point using exactly the statement parser's lexer/CST. */
export function parseExpression(source: SourceDocument, range: SourceRange): ParsedDocument<Expression> {
  const lexed = lexBody(source, range);
  const diagnostics = [...lexed.diagnostics];
  const tokens = lexed.tokens.filter((token) => token.kind !== "whitespace" && token.kind !== "eof");
  const parsed = readExpression(source, tokens, 0, range.end, diagnostics);
  if (parsed.next < parsed.tokens.length) diagnostics.push(createDiagnostic({ code: DiagnosticCodes.unexpectedToken, severity: "error", category: "syntax", message: "Unexpected token after expression.", range: parsed.tokens[parsed.next]!.range }));
  return Object.freeze({ source, syntax: parsed.expression, diagnostics: Object.freeze(diagnostics) });
}


/** Contextual selector grammar shared by expressions, DIM and assignable targets. */
export function readAccessGroup(source: SourceDocument, input: readonly BodyToken[], start: number, end: number, diagnostics: Diagnostic[], depth = 0): { readonly group: AccessGroup<Expression>; readonly tokens: readonly BodyToken[]; readonly next: number } {
  let tokens = input;
  let cursor = start + 1;
  let complete = true;
  let closed = false;
  const selectors: AccessSelector<Expression>[] = [];
  const position = (): number => tokens[cursor]?.range.start ?? end;
  const report = (message: string): void => {
    complete = false;
    diagnostics.push(createDiagnostic({ code: DiagnosticCodes.unexpectedToken, severity: "error", category: "syntax", message, range: source.range(position()) }));
  };
  const expression = (): Expression => {
    const parsed = readExpression(source, tokens, cursor, end, diagnostics, depth);
    tokens = parsed.tokens;
    cursor = parsed.next;
    return parsed.expression;
  };
  while (true) {
    const selectorStart = position();
    let from: Expression | undefined;
    let to: Expression | undefined;
    let hasTo = tokens[cursor]?.text.toUpperCase() === "TO";
    if (!hasTo && tokens[cursor] !== undefined && tokens[cursor]!.text !== ")" && tokens[cursor]!.text !== ",") from = expression();
    const toToken = tokens[cursor];
    if (toToken?.text.toUpperCase() === "TO") {
      hasTo = true;
      cursor++;
      if (tokens[cursor] !== undefined && tokens[cursor]!.text !== ")" && tokens[cursor]!.text !== ",") to = expression();
    }
    const selector: AccessSelector<Expression> = from !== undefined && !hasTo
      ? Object.freeze({ kind: "index", range: from.range, expression: from })
      : Object.freeze({ kind: "slice", range: source.range(selectorStart, to?.range.end ?? (hasTo ? toToken!.range.end : selectorStart)), hasTo, ...(from === undefined ? {} : { from }), ...(to === undefined ? {} : { to }) });
    selectors.push(selector);
    if (tokens[cursor]?.text === ")") { cursor++; closed = true; break; }
    if (tokens[cursor]?.text === ",") {
      if (selector.kind === "slice") report("A slice must be the final selector in its group.");
      cursor++;
      continue;
    }
    report("Expected ',' or ')' after subscript/slice.");
    break;
  }
  const finish = closed ? tokens[cursor - 1]!.range.end : position();
  const group: AccessGroup<Expression> = Object.freeze({ range: source.range(tokens[start]!.range.start, finish), selectors: Object.freeze(selectors), closed, complete: complete && closed });
  return Object.freeze({ group, tokens, next: cursor });
}
