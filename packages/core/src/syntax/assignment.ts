import { createDiagnostic, DiagnosticCodes } from "../source/diagnostic.js";
import type { Diagnostic } from "../source/diagnostic.js";
import type { SourceDocument, SourceRange } from "../source/document.js";
import { identifyVariable } from "../source/variable-identity.js";
import type { AssignableTarget } from "../source/assignment-target.js";
import type { BodyToken } from "./lexer.js";
import { readAccessGroup, readExpression } from "./expression.js";
import type { Expression } from "./expression.js";

export type AssignmentTarget = AssignableTarget<Expression>
  | { readonly kind: "error-target"; readonly range: SourceRange; readonly tokens: readonly BodyToken[]; readonly unsupported: boolean };
export interface LetStatement {
  readonly kind: "let";
  readonly range: SourceRange;
  readonly target: AssignmentTarget;
  readonly expression: Expression;
  readonly complete: boolean;
  readonly equalsRange?: SourceRange;
}

/** Shared assignable-target entry point for LET and later INPUT/READ grammar. */
export function parseAssignableTarget(source: SourceDocument, tokens: readonly BodyToken[], range: SourceRange, diagnostics: Diagnostic[]): AssignmentTarget {
  const fail = (message: string): AssignmentTarget => {
    diagnostics.push(createDiagnostic({ code: DiagnosticCodes.invalidAssignmentTarget, severity: "error", category: "syntax", message, range }));
    return Object.freeze({ kind: "error-target", range, tokens: Object.freeze([...tokens]), unsupported: false });
  };
  const open = tokens.findIndex((token) => token.text === "(");
  const nameRange = open < 0 ? range : open === 0 ? source.range(range.start) : source.range(range.start, tokens[open - 1]!.range.end);
  const spelling = source.textInRange(nameRange);
  const category = spelling.endsWith("$") ? "string-scalar" : open < 0 ? "numeric-scalar" : "numeric-array";
  const identified = identifyVariable(spelling, category);
  if (identified.kind === "error") return fail("Expected an assignable variable/array name, not an expression.");
  if (open < 0) return Object.freeze({ kind: "scalar-target", range, identity: identified.identity });
  let cursor = open;
  let working = tokens;
  const groups = [];
  while (working[cursor]?.text === "(") {
    const parsed = readAccessGroup(source, working, cursor, range.end, diagnostics);
    working = parsed.tokens;
    cursor = parsed.next;
    groups.push(parsed.group);
  }
  if (cursor !== working.length) return fail("Unexpected token after assignable array/slice target.");
  return Object.freeze({ kind: "indexed-target", range, nameRange, identity: identified.identity, groups: Object.freeze(groups) });
}

export function parseLetStatement(source: SourceDocument, tokens: readonly BodyToken[], range: SourceRange, diagnostics: Diagnostic[]): LetStatement {
  let depth = 0;
  let equals = -1;
  for (let index = 1; index < tokens.length; index++) {
    const text = tokens[index]!.text;
    if (text === "(") depth++;
    else if (text === ")") depth--;
    else if (text === "=" && depth === 0) { equals = index; break; }
  }
  const targetTokens = tokens.slice(1, equals < 0 ? tokens.length : equals);
  const insertion = equals < 0 ? range.end : tokens[equals]!.range.start;
  const targetRange = targetTokens.length === 0 ? source.range(insertion)
    : source.range(targetTokens[0]!.range.start, targetTokens[targetTokens.length - 1]!.range.end);
  const target = parseAssignableTarget(source, targetTokens, targetRange, diagnostics);
  let complete = equals >= 0;
  if (!complete) diagnostics.push(createDiagnostic({ code: DiagnosticCodes.unexpectedToken, severity: "error", category: "syntax", message: "Expected '=' after LET target.", range: source.range(range.end) }));
  const parsed = readExpression(source, tokens, equals < 0 ? tokens.length : equals + 1, range.end, diagnostics);
  if (parsed.next < parsed.tokens.length) {
    complete = false;
    diagnostics.push(createDiagnostic({ code: DiagnosticCodes.unexpectedToken, severity: "error", category: "syntax", message: "Unexpected token after LET expression.", range: parsed.tokens[parsed.next]!.range }));
  }
  return Object.freeze({ kind: "let", range, target, expression: parsed.expression, ...(equals < 0 ? {} : { equalsRange: tokens[equals]!.range }), complete });
}
