import { SourceDocument } from "../source/document.js";
import type { SourceRange } from "../source/document.js";
import { parseBasic } from "./parser.js";
import type { BasicSyntaxProgram, Statement } from "./parser.js";
import type { ParsedDocument } from "./document.js";
import type { Expression } from "./expression.js";
export interface ParserCompletionContext {
  readonly kind: "statement-start" | "expression" | "statement-argument" | "string" | "rem" | "line-number" | "unknown";
  readonly expectedType?: "numeric" | "string";
  readonly command?: string;
  readonly keywords: readonly string[];
  readonly lineTargets: boolean;
  readonly editRange: SourceRange;
  readonly prefix: string;
  readonly statement?: Statement;
  readonly functionName?: boolean;
  readonly functionArgument?: { readonly name: string; readonly index: number; readonly user: boolean };
}
const printKeywords = Object.freeze(["AT", "TAB", "INK", "PAPER", "FLASH", "BRIGHT", "INVERSE", "OVER"]);
function inferred(expression: Expression): "numeric" | "string" | undefined {
  if (expression.kind === "string-literal") return "string";
  if (expression.kind === "name-expression") return expression.identity.valueType;
  if (expression.kind === "numeric-literal" || expression.kind === "binary-literal") return "numeric";
  return undefined;
}
function complete(expression: Expression): boolean {
  if (expression.kind === "error-expression") return false;
  if (expression.kind === "binary-expression") return complete(expression.left) && complete(expression.right);
  if (expression.kind === "unary-expression") return complete(expression.operand);
  if (expression.kind === "parenthesized-expression") return expression.closed && complete(expression.expression);
  if (expression.kind === "builtin-call" || expression.kind === "user-function-call") return expression.arguments.every(complete) && (expression.kind === "builtin-call" ? expression.closed : expression.complete);
  return true;
}
/** Prefix parsing shares the build grammar; this helper describes its current CST state. */
export function parserCompletionContext(parsed: ParsedDocument<BasicSyntaxProgram>, offset: number): ParserCompletionContext {
  const source = parsed.source;
  source.positionAt(offset);
  const prefixParsed = parseBasic(new SourceDocument(source.id, source.text.slice(0, offset)));
  const line = prefixParsed.syntax.lines.at(-1)!;
  let editRange = source.range(offset);
  let prefix = "";
  const originalLine = parsed.syntax.lines.find((item) => item.contentRange.start <= offset && offset <= item.contentRange.end);
  const originalWord = originalLine?.kind === "numbered" ? originalLine.tokens.find((token) => (token.kind === "word" || token.kind === "number") && token.range.start <= offset && offset <= token.range.end) : undefined;
  if (originalWord !== undefined) {
    editRange = source.range(originalWord.range.start, originalWord.range.end);
    prefix = source.text.slice(originalWord.range.start, offset);
  }
  const base = { editRange, prefix, keywords: Object.freeze([]) as readonly string[], lineTargets: false };
  if (line.kind !== "numbered" || offset <= line.numberRange.end) return Object.freeze({ ...base, kind: "line-number" });
  const tokens = line.tokens.filter((token) => token.kind !== "whitespace" && token.kind !== "eof");
  const last = tokens.at(-1);
  if (last?.kind === "string" && !last.closed) return Object.freeze({ ...base, kind: "string" });
  let statement = line.statements.at(-1);
  while (statement?.kind === "if" && statement.complete && statement.thenStatements.length !== 0) statement = statement.thenStatements.at(-1);
  if (statement?.kind === "rem") return Object.freeze({ ...base, kind: "rem", statement });
  const contextual = { ...base, ...(statement === undefined ? {} : { statement }) };
  const expression = (root: Expression | undefined, expectedType?: "numeric" | "string", keywords: readonly string[] = []): ParserCompletionContext => {
    let node = root;
    let argument: ParserCompletionContext["functionArgument"];
    let functionName = false;
    while (node !== undefined) {
      if (node.kind === "binary-expression") {
        expectedType = node.operator === "+" || ["=", "<", ">", "<=", ">=", "<>"].includes(node.operator) ? inferred(node.left) ?? expectedType : "numeric";
        node = node.right;
      } else if (node.kind === "unary-expression") { expectedType = "numeric"; node = node.operand; }
      else if (node.kind === "parenthesized-expression") node = node.expression;
      else if (node.kind === "builtin-call" || node.kind === "user-function-call") {
        if (node.kind === "user-function-call" && node.name.range.start === editRange.start && node.name.range.end === offset) functionName = true;
        argument = { name: node.kind === "builtin-call" ? node.token.spelling : node.name.identity?.canonicalName ?? "", index: Math.max(0, node.arguments.length - 1), user: node.kind === "user-function-call" };
        node = node.arguments.at(-1);
      } else if (node.kind === "access-expression") {
        expectedType = "numeric";
        const selector = node.group.selectors.at(-1);
        node = selector?.kind === "index" ? selector.expression : selector?.to ?? selector?.from;
      } else break;
    }
    return Object.freeze({ ...contextual, kind: "expression", keywords: Object.freeze([...keywords]), ...(expectedType === undefined ? {} : { expectedType }), ...(argument === undefined ? {} : { functionArgument: Object.freeze(argument) }), ...(functionName ? { functionName } : {}) });
  };
  if (statement === undefined || statement.kind === "empty") return Object.freeze({ ...contextual, kind: "statement-start" });
  const statementTokens = tokens.filter((token) => token.range.start >= statement.range.start);
  const command = statementTokens[0];
  const commandPrefix = command?.kind === "word" && command.range.end === offset && statementTokens.length === 1;
  if (commandPrefix) return Object.freeze({ ...contextual, kind: "statement-start" });
  if (statement.kind === "error-statement") {
    const words = statement.tokens;
    const first = words[0]?.text.toUpperCase();
    if (first === "GO") return Object.freeze({ ...contextual, kind: "statement-argument", command: "GO", keywords: Object.freeze(["TO", "SUB"]) });
    if (first === "DEF") return Object.freeze({ ...contextual, kind: "statement-argument", command: "DEF", keywords: Object.freeze(["FN"]) });
    return Object.freeze({ ...contextual, kind: statementTokens.length <= 1 ? "statement-start" : "unknown" });
  }
  if (statement.kind === "if") return expression(statement.condition, "numeric", complete(statement.condition) ? ["THEN"] : []);
  if (statement.kind === "for") {
    if (statement.equalsRange === undefined) return Object.freeze({ ...contextual, kind: "statement-argument", expectedType: "numeric", command: "FOR", keywords: Object.freeze(statement.variable.kind === "scalar-target" ? ["="] : []) });
    if (statement.toRange === undefined) return expression(statement.start, "numeric", complete(statement.start) ? ["TO"] : []);
    return expression(statement.step ?? statement.limit, "numeric", statement.stepRange === undefined && complete(statement.limit) ? ["STEP"] : []);
  }
  if (statement.kind === "let") return statement.equalsRange === undefined ? Object.freeze({ ...contextual, kind: "statement-argument", ...(statement.target.kind === "error-target" ? {} : { expectedType: statement.target.identity.valueType }), command: "LET" }) : expression(statement.expression, statement.target.kind === "error-target" ? undefined : statement.target.identity.valueType);
  if (statement.kind === "goto" || statement.kind === "gosub") return Object.freeze({ ...expression(statement.target, "numeric"), command: statement.kind === "goto" ? "GO TO" : "GO SUB", lineTargets: true });
  if (statement.kind === "print" || statement.kind === "lprint") {
    const item = statement.items.at(-1);
    if (item?.kind === "print-at") return expression(item.column, "numeric");
    if (item?.kind === "print-tab") return expression(item.column, "numeric");
    if (item?.kind === "print-channel") return expression(item.stream, "numeric");
    if (item?.kind === "print-control") return expression(item.expression, "numeric");
    const root = item?.kind === "print-expression" ? item.expression : undefined;
    return expression(root, undefined, root === undefined || root.kind === "name-expression" || root.kind === "error-expression" ? printKeywords : []);
  }
  if (statement.kind === "simple-command") {
    const shape = statement.definition.shape;
    if (shape === "none") return Object.freeze({ ...contextual, kind: "unknown" });
    return expression(statement.operands.at(-1), shape === "string" || shape === "string-pair" || (shape === "open" && statement.operands.length > 1) ? "string" : "numeric");
  }
  if (statement.kind === "data") return expression(statement.items.at(-1));
  if (statement.kind === "dim") return expression(undefined, "numeric");
  if (statement.kind === "def-fn") return expression(statement.body, statement.name.identity?.valueType);
  if (statement.kind === "cassette") return expression(statement.filename, "string");
  return Object.freeze({ ...contextual, kind: "unknown" });
}
