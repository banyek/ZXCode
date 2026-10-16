import { createDiagnostic, DiagnosticCodes } from "../source/diagnostic.js";
import type { Diagnostic } from "../source/diagnostic.js";
import type { SourceDocument, SourceRange } from "../source/document.js";
import type { ParsedDocument } from "../syntax/document.js";
import type { BasicSyntaxProgram, LiteralExpression, Statement } from "../syntax/parser.js";
import { convertNumericLiteral } from "./numeric.js";
import type { NumericLiteralValue } from "./numeric.js";

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

export type BasicExpression =
  | { readonly kind: "string"; readonly range: SourceRange; readonly value: string; readonly bytes: readonly number[] }
  | { readonly kind: "number"; readonly range: SourceRange; readonly value: NumericLiteralValue };

export type BasicPrintItem =
  | { readonly kind: "print-expression"; readonly range: SourceRange; readonly expression: BasicExpression }
  | { readonly kind: "print-separator"; readonly range: SourceRange; readonly separator: ";" | "," };

export type BasicStatement =
  | { readonly kind: "print"; readonly range: SourceRange; readonly items: readonly BasicPrintItem[] }
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
  const report = (range: SourceRange, message: string, code: string, category: Diagnostic["category"]): void => {
    if (diagnostics.some((item) => item.severity === "error" && item.range.sourceId === range.sourceId && item.range.start >= range.start && item.range.end <= range.end)) return;
    diagnostics.push(createDiagnostic({ code, severity: "error", category, message, range }));
  };
  const expression = (node: LiteralExpression): BasicExpression | undefined => {
    if (node.kind === "numeric-literal") {
      const result = convertNumericLiteral(node.lexeme);
      if (result.kind === "error") {
        report(node.range, result.reason === "overflow" ? "Numeric literal overflows the original 48K ROM representation." : "Invalid decimal numeric literal.",
          result.reason === "overflow" ? DiagnosticCodes.numericOverflow : DiagnosticCodes.invalidNumericLiteral,
          result.reason === "overflow" ? "compatibility" : "syntax");
        return undefined;
      }
      return Object.freeze({ kind: "number", range: node.range, value: result.value });
    }
    if (!node.closed) {
      report(node.range, "String literal is incomplete.", DiagnosticCodes.unterminatedString, "syntax");
      return undefined;
    }
    const bytes: number[] = [];
    let offset = node.contentRange.start;
    let valid = true;
    for (const character of node.value) {
      const code = character.codePointAt(0)!;
      if (code < 32 || code > 126 || code === 96) {
        report(source.range(offset, offset + character.length), "Character is outside M1's directly representable Spectrum string subset.", DiagnosticCodes.unsupportedCharacter, "compatibility");
        valid = false;
      } else bytes.push(code);
      offset += character.length;
    }
    return valid ? Object.freeze({ kind: "string", range: node.range, value: node.value, bytes: Object.freeze(bytes) }) : undefined;
  };
  const statement = (node: Statement): BasicStatement | undefined => {
    if (node.kind === "error-statement") {
      report(node.range, "Malformed/unsupported statements cannot be built.", DiagnosticCodes.unsupportedSyntax, "compatibility");
      return undefined;
    }
    if (node.kind !== "print") return Object.freeze({ kind: node.kind, range: node.range });
    const items: BasicPrintItem[] = [];
    let valid = true;
    for (const item of node.items) {
      if (item.kind === "print-separator") items.push(item);
      else {
        const value = expression(item.expression);
        if (value === undefined) valid = false;
        else items.push(Object.freeze({ kind: "print-expression", range: item.range, expression: value }));
      }
    }
    return valid ? Object.freeze({ kind: "print", range: node.range, items: Object.freeze(items) }) : undefined;
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
    const statements: BasicStatement[] = [];
    for (const node of line.statements) {
      const value = statement(node);
      if (value !== undefined) statements.push(value);
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
