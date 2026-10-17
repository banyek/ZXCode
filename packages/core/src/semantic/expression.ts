import { createDiagnostic, DiagnosticCodes } from "../source/diagnostic.js";
import type { Diagnostic } from "../source/diagnostic.js";
import type { SourceDocument, SourceRange } from "../source/document.js";
import { romTokenBySpelling } from "../source/rom-tokens.js";
import type { RomToken } from "../source/rom-tokens.js";
import { identifyVariable } from "../source/variable-identity.js";
import type { VariableIdentity } from "../source/variable-identity.js";
import type { ParsedDocument } from "../syntax/document.js";
import type { Expression } from "../syntax/expression.js";
import { convertNumericLiteral } from "./numeric.js";
import type { NumericLiteralValue } from "./numeric.js";

export type ExpressionType = "numeric" | "string" | "unknown" | "error";
export type ExpectedExpressionType = "numeric" | "string" | "numeric-or-string";
export interface BuiltinSignature {
  readonly token: RomToken;
  readonly arguments: readonly ExpectedExpressionType[];
  readonly result: "numeric" | "string";
}
const signature = (name: string, args: readonly ExpectedExpressionType[], result: "numeric" | "string"): BuiltinSignature => Object.freeze({ token: romTokenBySpelling(name)!, arguments: Object.freeze([...args]), result });
export const BUILTIN_SIGNATURES: readonly BuiltinSignature[] = Object.freeze([
  signature("RND", [], "numeric"), signature("PI", [], "numeric"), signature("INKEY$", [], "string"),
  ...["POINT", "ATTR"].map((name) => signature(name, ["numeric", "numeric"], "numeric")),
  signature("SCREEN$", ["numeric", "numeric"], "string"), signature("VAL$", ["string"], "string"),
  ...["CODE", "VAL", "LEN"].map((name) => signature(name, ["string"], "numeric")),
  ...["SIN", "COS", "TAN", "ASN", "ACS", "ATN", "LN", "EXP", "INT", "SQR", "SGN", "ABS", "PEEK", "IN"].map((name) => signature(name, ["numeric"], "numeric")),
  signature("USR", ["numeric-or-string"], "numeric"),
  signature("STR$", ["numeric"], "string"), signature("CHR$", ["numeric"], "string")
]);
const signatures = new Map(BUILTIN_SIGNATURES.map((item) => [item.token.spelling, item]));
interface TypedBase { readonly range: SourceRange; readonly type: ExpressionType }
export type TypedExpression = TypedBase & (
  | { readonly kind: "string"; readonly value: string; readonly bytes: readonly number[] }
  | { readonly kind: "number"; readonly value: NumericLiteralValue }
  | { readonly kind: "binary-literal"; readonly digits: string; readonly value: NumericLiteralValue }
  | { readonly kind: "name"; readonly identity: VariableIdentity }
  | { readonly kind: "builtin-value"; readonly token: RomToken }
  | { readonly kind: "builtin-call"; readonly token: RomToken; readonly arguments: readonly TypedExpression[] }
  | { readonly kind: "unary"; readonly operator: "+" | "-" | "NOT"; readonly operand: TypedExpression }
  | { readonly kind: "binary"; readonly operator: string; readonly left: TypedExpression; readonly right: TypedExpression }
  | { readonly kind: "parenthesized"; readonly expression: TypedExpression }
  | { readonly kind: "error"; readonly children: readonly TypedExpression[] }
);
export interface ExpressionAnalysis {
  readonly source: SourceDocument;
  readonly expression: TypedExpression;
  readonly diagnostics: readonly Diagnostic[];
}

export function requireExpressionType(expression: TypedExpression, expected: ExpectedExpressionType, diagnostics: Diagnostic[]): boolean {
  if (expression.type === "error" || expression.type === "unknown") return false;
  if (expected === "numeric-or-string" || expression.type === expected) return true;
  diagnostics.push(createDiagnostic({ code: DiagnosticCodes.typeMismatch, severity: "error", category: "semantic", message: `Expected ${expected} expression; got ${expression.type}.`, range: expression.range }));
  return false;
}

/** Shared nonrecursive semantic visitor; never evaluates runtime expressions. */
export function analyzeExpressionNode(source: SourceDocument, root: Expression, diagnostics: Diagnostic[]): TypedExpression {
  const results = new Map<Expression, TypedExpression>();
  const work: { node: Expression; visited: boolean }[] = [{ node: root, visited: false }];
  const childrenOf = (node: Expression): readonly Expression[] => node.kind === "binary-expression" ? [node.left, node.right]
    : node.kind === "unary-expression" ? [node.operand] : node.kind === "parenthesized-expression" ? [node.expression]
      : node.kind === "builtin-call" ? node.arguments : [];
  const report = (node: Expression, message: string, code: string, category: Diagnostic["category"]): void => {
    if (!diagnostics.some((item) => item.severity === "error" && item.range.start >= node.range.start && item.range.end <= node.range.end)) diagnostics.push(createDiagnostic({ code, severity: "error", category, message, range: node.range }));
  };
  while (work.length !== 0) {
    const { node, visited } = work.pop()!;
    const children = childrenOf(node);
    if (!visited) {
      work.push({ node, visited: true });
      for (let index = children.length - 1; index >= 0; index--) work.push({ node: children[index]!, visited: false });
      continue;
    }
    const args = children.map((child) => results.get(child)!);
    const fail = (): TypedExpression => Object.freeze({ kind: "error", type: "error", range: node.range, children: Object.freeze(args) });
    let result: TypedExpression;
    if (node.kind === "error-expression") {
      report(node, "Malformed expression cannot be built.", DiagnosticCodes.unexpectedToken, "syntax");
      result = fail();
    } else if (node.kind === "numeric-literal" || node.kind === "binary-literal") {
      let lexeme = node.lexeme;
      let valid = true;
      if (node.kind === "binary-literal") {
        let integer = 0;
        valid = /^[01]*$/.test(lexeme);
        for (const digit of lexeme) {
          integer = integer * 2 + Number(digit);
          if (integer > 65535) { valid = false; break; }
        }
        if (!valid) report(node, "BIN literal exceeds 65535 or contains invalid digits.", DiagnosticCodes.numericOverflow, "compatibility");
        lexeme = String(integer);
      }
      const converted = valid ? convertNumericLiteral(lexeme) : undefined;
      if (converted?.kind !== "success") {
        if (valid) report(node, "Invalid or overflowing numeric literal.", converted?.reason === "overflow" ? DiagnosticCodes.numericOverflow : DiagnosticCodes.invalidNumericLiteral, converted?.reason === "overflow" ? "compatibility" : "syntax");
        result = fail();
      } else result = Object.freeze(node.kind === "numeric-literal"
        ? { kind: "number", type: "numeric", range: node.range, value: converted.value }
        : { kind: "binary-literal", type: "numeric", range: node.range, digits: node.lexeme, value: converted.value });
    } else if (node.kind === "string-literal") {
      let valid = node.closed;
      if (!valid) report(node, "String literal is incomplete.", DiagnosticCodes.unterminatedString, "syntax");
      const bytes: number[] = [];
      let offset = node.contentRange.start;
      for (const character of node.value) {
        const byte = character.codePointAt(0)!;
        if (byte < 32 || byte > 126 || byte === 96) {
          diagnostics.push(createDiagnostic({ code: DiagnosticCodes.unsupportedCharacter, severity: "error", category: "compatibility", message: "Character is outside the directly representable Spectrum string subset.", range: source.range(offset, offset + character.length) }));
          valid = false;
        } else bytes.push(byte);
        offset += character.length;
      }
      result = valid ? Object.freeze({ kind: "string", type: "string", range: node.range, value: node.value, bytes: Object.freeze(bytes) }) : fail();
    } else if (node.kind === "name-expression") {
      const identified = identifyVariable(node.spelling, node.spelling.endsWith("$") ? "string-scalar" : "numeric-scalar");
      if (identified.kind === "error") {
        report(node, "Invalid variable name.", DiagnosticCodes.invalidVariableName, "syntax");
        result = fail();
      } else result = Object.freeze({ kind: "name", type: identified.identity.valueType, range: node.range, identity: identified.identity });
    } else if (node.kind === "builtin-value" || node.kind === "builtin-call") {
      const definition = signatures.get(node.token.spelling);
      let valid = definition !== undefined && definition.arguments.length === args.length;
      if (node.kind === "builtin-call" && !node.closed) {
        report(node, "Function argument delimiters are incomplete.", DiagnosticCodes.unexpectedToken, "syntax");
        valid = false;
      }
      if (definition === undefined || definition.arguments.length !== args.length) report(node, "Unsupported function or wrong argument count.", DiagnosticCodes.typeMismatch, "semantic");
      if (definition !== undefined) for (let index = 0; index < args.length; index++) {
        const expected = definition.arguments[index];
        if (expected === undefined || !requireExpressionType(args[index]!, expected, diagnostics)) valid = false;
      }
      result = !valid ? fail() : Object.freeze(node.kind === "builtin-value"
        ? { kind: "builtin-value", range: node.range, type: definition!.result, token: definition!.token }
        : { kind: "builtin-call", range: node.range, type: definition!.result, token: definition!.token, arguments: Object.freeze(args) });
    } else if (node.kind === "parenthesized-expression") {
      if (!node.closed) report(node, "Parenthesized expression is incomplete.", DiagnosticCodes.unexpectedToken, "syntax");
      result = node.closed ? Object.freeze({ kind: "parenthesized", range: node.range, type: args[0]!.type, expression: args[0]! }) : fail();
    } else if (node.kind === "unary-expression") {
      const operand = args[0]!;
      const valid = node.operator === "+" ? operand.type === "numeric" || operand.type === "string" : requireExpressionType(operand, "numeric", diagnostics);
      result = valid ? Object.freeze({ kind: "unary", range: node.range, type: operand.type, operator: node.operator, operand }) : fail();
    } else {
      const [left, right] = args as [TypedExpression, TypedExpression];
      let valid = left.type !== "error" && left.type !== "unknown" && right.type !== "error" && right.type !== "unknown";
      let type: ExpressionType = "numeric";
      if (valid && (node.operator === "+" || ["=", "<", ">", "<=", ">=", "<>"].includes(node.operator))) {
        valid = requireExpressionType(right, left.type as "numeric" | "string", diagnostics);
        if (node.operator === "+") type = left.type;
      } else if (valid && node.operator === "AND") {
        valid = requireExpressionType(right, "numeric", diagnostics);
        type = left.type;
      } else if (valid) {
        const numericLeft = requireExpressionType(left, "numeric", diagnostics);
        const numericRight = requireExpressionType(right, "numeric", diagnostics);
        valid = numericLeft && numericRight;
      }
      if (!["+", "-", "*", "/", "^", "=", "<", ">", "<=", ">=", "<>", "AND", "OR"].includes(node.operator)) {
        report(node, "Unsupported binary operator.", DiagnosticCodes.unsupportedSyntax, "compatibility");
        valid = false;
      }
      result = valid ? Object.freeze({ kind: "binary", range: node.range, type, operator: node.operator, left, right }) : fail();
    }
    results.set(node, result);
  }
  return results.get(root)!;
}

export function analyzeExpression(parsed: ParsedDocument<Expression>, expected?: ExpectedExpressionType): ExpressionAnalysis {
  const diagnostics = [...parsed.diagnostics];
  const expression = analyzeExpressionNode(parsed.source, parsed.syntax, diagnostics);
  if (expected !== undefined) requireExpressionType(expression, expected, diagnostics);
  return Object.freeze({ source: parsed.source, expression, diagnostics: Object.freeze(diagnostics) });
}
