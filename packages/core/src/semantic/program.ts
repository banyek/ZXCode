import { analyzeDefFnStatement, functionBinding } from "./functions.js";
import type { BasicDefFnStatement } from "./functions.js";
import type { FunctionBinding, FunctionContext } from "./function-context.js";
import { analyzeDataStatement, analyzeReadStatement } from "./data.js";
import type { BasicDataStatement, BasicReadStatement } from "./data.js";
import { analyzeDimStatement } from "./dim.js";
import type { BasicDimStatement } from "./dim.js";
import { analyzeInputStatement } from "./input.js";
import type { BasicInputStatement } from "./input.js";
import { analyzePrintStatement } from "./print.js";
import type { PrintItem as SourcePrintItem, PrintStatement as SourcePrintStatement } from "../source/print-items.js";
import { analyzeLoop } from "./loops.js";
import type { BasicForStatement, BasicNextStatement } from "./loops.js";
import { analyzeLetStatement } from "./assignment.js";
import type { BasicLetStatement } from "./assignment.js";
import { analyzeSimpleCommand } from "./simple-commands.js";
import type { SimpleCommandStatement } from "../source/simple-commands.js";
import { createDiagnostic, DiagnosticCodes } from "../source/diagnostic.js";
import type { Diagnostic } from "../source/diagnostic.js";
import type { SourceDocument, SourceRange } from "../source/document.js";
import type { ParsedDocument } from "../syntax/document.js";
import type { BasicSyntaxProgram, Statement } from "../syntax/parser.js";
import { analyzeExpressionNode, requireExpressionType } from "./expression.js";
import type { TypedExpression } from "./expression.js";

export interface AnalyzedProgram<TProgram> {
  readonly source: SourceDocument;
  readonly program: TProgram;
  readonly diagnostics: readonly Diagnostic[];
}

const buildableProgram: unique symbol = Symbol("validated BASIC program");
const validatedPrograms = new WeakSet<object>();

/** Only semantic validation can attest that the program is safe to encode. */
export interface BuildableProgram<TProgram> extends AnalyzedProgram<TProgram> {
  readonly [buildableProgram]: true;
}

export type BasicExpression = TypedExpression;

export type BasicPrintItem = SourcePrintItem<TypedExpression>;
export type BasicPrintStatement = SourcePrintStatement<TypedExpression>;

export interface StaticLineReference {
  readonly lineNumber: number;
  readonly range: SourceRange;
  readonly definitionRange?: SourceRange;
}
export interface BasicJumpStatement {
  readonly kind: "goto" | "gosub";
  readonly range: SourceRange;
  readonly target: TypedExpression;
  readonly lineReference?: StaticLineReference;
}
export interface BasicIfStatement {
  readonly kind: "if";
  readonly range: SourceRange;
  readonly headerRange: SourceRange;
  readonly condition: TypedExpression;
  readonly thenStatements: readonly BasicStatement[];
}
export type BasicStatement = BasicDefFnStatement | BasicDataStatement | BasicReadStatement | BasicDimStatement | BasicInputStatement | BasicForStatement | BasicNextStatement | BasicIfStatement | BasicJumpStatement
  | { readonly kind: "empty"; readonly range: SourceRange }
  | BasicLetStatement | SimpleCommandStatement<TypedExpression>
  | BasicPrintStatement
  | { readonly kind: "cls" | "stop"; readonly range: SourceRange };

export interface BasicLine {
  readonly lineNumber: number;
  readonly range: SourceRange;
  readonly numberRange: SourceRange;
  readonly statements: readonly BasicStatement[];
}

export interface BasicProgram {
  readonly kind: "basic-program";
  readonly lines: readonly BasicLine[];
}

export type BasicAnalysisResult =
  | { readonly kind: "buildable"; readonly analysis: BuildableProgram<BasicProgram> }
  | { readonly kind: "invalid"; readonly analysis: AnalyzedProgram<BasicProgram> };

/** Analyze parsed nodes once; error nodes/diagnostics cannot acquire the brand. */
export function analyzeBasic(parsed: ParsedDocument<BasicSyntaxProgram>): BasicAnalysisResult {
  const source = parsed.source;
  const diagnostics = [...parsed.diagnostics];
  const lines: BasicLine[] = [];
  const firstNumbers = new Map<number, SourceRange>();
  const definitions = new Map<number, SourceRange>();
  for (const line of parsed.syntax.lines) if (line.kind === "numbered" && !definitions.has(line.lineNumber)) definitions.set(line.lineNumber, line.numberRange);
  const lineReference = (target: TypedExpression): StaticLineReference | undefined => {
    if (target.kind !== "number" && target.kind !== "binary-literal") return undefined;
    const storage = target.value.storage;
    const exponent = storage[0]!, a = storage[1]!, b = storage[2]!, c = storage[3]!, d = storage[4]!;
    const value = exponent === 0 ? b + c * 256 - (a === 255 ? 65536 : 0)
      : (a & 128 ? -1 : 1) * (1 + ((a & 127) * 2 ** 24 + b * 65536 + c * 256 + d) / 2 ** 31) * 2 ** (exponent - 129);
    if (!Number.isInteger(value) || value < 1 || value > 9999) return undefined;
    const definitionRange = definitions.get(value);
    if (definitionRange === undefined) diagnostics.push(createDiagnostic({ code: DiagnosticCodes.missingLineTarget, severity: "warning", category: "semantic", message: `No stored BASIC line numbered ${value}.`, range: target.range }));
    return Object.freeze({ lineNumber: value, range: target.range, ...(definitionRange === undefined ? {} : { definitionRange }) });
  };
  const report = (range: SourceRange, message: string, code: string, category: Diagnostic["category"]): void => {
    if (diagnostics.some((item) => item.severity === "error" && item.range.sourceId === range.sourceId && item.range.start >= range.start && item.range.end <= range.end)) return;
    diagnostics.push(createDiagnostic({ code, severity: "error", category, message, range }));
  };
  const functions = new Map<string, FunctionBinding>();
  const numbered = parsed.syntax.lines.filter((line) => line.kind === "numbered").sort((a, b) => a.lineNumber - b.lineNumber);
  for (const line of numbered) {
    const pending = [...line.statements].reverse();
    while (pending.length !== 0) {
      const node = pending.pop()!;
      if (node.kind === "if") pending.push(...[...node.thenStatements].reverse());
      if (node.kind === "def-fn") {
        const binding = functionBinding(node);
        if (binding !== undefined && !functions.has(binding.identity.key)) functions.set(binding.identity.key, binding);
      }
    }
  }
  const context: FunctionContext = { definitions: functions };
  const statement = (node: Statement): BasicStatement | undefined => {
    if (node.kind === "error-statement") {
      report(node.range, "Malformed/unsupported statements cannot be built.", DiagnosticCodes.unsupportedSyntax, "compatibility");
      return undefined;
    }
    if (node.kind === "empty") return node;
    if (node.kind === "goto" || node.kind === "gosub") {
      const target = analyzeExpressionNode(source, node.target, diagnostics, context);
      const valid = requireExpressionType(target, "numeric", diagnostics);
      if (!node.complete) report(node.range, "Jump target expression is malformed.", DiagnosticCodes.unexpectedToken, "syntax");
      if (!valid || !node.complete) return undefined;
      const reference = lineReference(target);
      return Object.freeze({ kind: node.kind, range: node.range, target, ...(reference === undefined ? {} : { lineReference: reference }) });
    }
    if (node.kind === "if") {
      const condition = analyzeExpressionNode(source, node.condition, diagnostics, context);
      let valid = requireExpressionType(condition, "numeric", diagnostics);
      if (!node.complete) { report(node.range, "IF requires THEN and a recoverable statement tail.", DiagnosticCodes.unexpectedToken, "syntax"); valid = false; }
      const tail: BasicStatement[] = [];
      for (const child of node.thenStatements) {
        const converted = statement(child);
        if (converted === undefined) valid = false;
        else tail.push(converted);
      }
      if (tail.length === 0) tail.push(Object.freeze({ kind: "empty", range: source.range(node.range.end) }));
      return valid ? Object.freeze({ kind: "if", range: node.range, headerRange: node.headerRange, condition, thenStatements: Object.freeze(tail) }) : undefined;
    }
    if (node.kind === "def-fn") return analyzeDefFnStatement(source, node, diagnostics, context);
    if (node.kind === "data") return analyzeDataStatement(source, node, diagnostics, context);
    if (node.kind === "read") return analyzeReadStatement(source, node, diagnostics, context);
    if (node.kind === "dim") return analyzeDimStatement(source, node, diagnostics, context);
    if (node.kind === "input") return analyzeInputStatement(source, node, diagnostics, context);
    if (node.kind === "for" || node.kind === "next") return analyzeLoop(source, node, diagnostics, context);
    if (node.kind === "let") return analyzeLetStatement(source, node, diagnostics, context);
    if (node.kind === "simple-command") return analyzeSimpleCommand(source, node, diagnostics, context);
    if (node.kind === "print" || node.kind === "lprint") return analyzePrintStatement(source, node, diagnostics, context);
    return Object.freeze({ kind: node.kind, range: node.range });
  };
  for (const line of parsed.syntax.lines) {
    if (line.kind === "blank") continue;
    if (line.kind === "invalid") {
      report(line.range, "Invalid physical line header.", DiagnosticCodes.invalidLineNumber, "syntax");
      continue;
    }
    if (!Number.isInteger(line.lineNumber) || line.lineNumber < 1 || line.lineNumber > 9999) {
      report(line.numberRange, "Stored BASIC line number is out of range.", DiagnosticCodes.invalidLineNumber, "syntax");
    }
    const first = firstNumbers.get(line.lineNumber);
    if (first !== undefined) report(line.numberRange, "Duplicate BASIC line number.", DiagnosticCodes.duplicateLineNumber, "syntax");
    else firstNumbers.set(line.lineNumber, line.numberRange);
    if (line.statements.length === 0) report(line.bodyRange, "Expected a BASIC statement.", DiagnosticCodes.missingStatement, "syntax");
    const countWork = [...line.statements];
    let statementCount = 0;
    while (countWork.length !== 0) {
      const counted = countWork.pop()!;
      statementCount++;
      if (counted.kind === "if") for (const child of counted.thenStatements) countWork.push(child);
    }
    if (statementCount > 127) report(line.bodyRange, "The 48K ROM supports at most 127 statements in one BASIC line.", DiagnosticCodes.tooManyStatements, "compatibility");
    const statements: BasicStatement[] = [];
    for (const node of line.statements) {
      const value = statement(node);
      if (value !== undefined) statements.push(value);
      else report(node.range, "Statement is incomplete or unsupported.", DiagnosticCodes.unsupportedSyntax, "compatibility");
    }
    lines.push(Object.freeze({ lineNumber: line.lineNumber, range: line.range, numberRange: line.numberRange, statements: Object.freeze(statements) }));
  }
  lines.sort((a, b) => a.lineNumber - b.lineNumber);
  const analysis: AnalyzedProgram<BasicProgram> = Object.freeze({
    source,
    program: Object.freeze({ kind: "basic-program", lines: Object.freeze(lines) }),
    diagnostics: Object.freeze(diagnostics)
  });
  if (diagnostics.some((item) => item.severity === "error")) return Object.freeze({ kind: "invalid", analysis });
  const buildable: BuildableProgram<BasicProgram> = Object.freeze({ ...analysis, [buildableProgram]: true as const });
  validatedPrograms.add(buildable);
  return Object.freeze({ kind: "buildable", analysis: buildable });
}

/** Internal runtime encoder guard; no unchecked builder is exported. */
export function assertBuildableProgram(program: BuildableProgram<BasicProgram>): void {
  if (!validatedPrograms.has(program)) throw new TypeError("Expected a validated BuildableProgram.");
}
