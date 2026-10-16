import { createDiagnostic, DiagnosticCodes } from "../source/diagnostic.js";
import type { Diagnostic } from "../source/diagnostic.js";
import type { SourceDocument, SourceRange } from "../source/document.js";
import type { ParsedDocument } from "./document.js";

export interface PhysicalLineBase {
  readonly physicalLine: number;
  readonly range: SourceRange;
  readonly contentRange: SourceRange;
  readonly lineEndingRange: SourceRange;
}

export interface BlankPhysicalLine extends PhysicalLineBase {
  readonly kind: "blank";
}

export interface NumberedPhysicalLine extends PhysicalLineBase {
  readonly kind: "numbered";
  readonly lineNumber: number;
  readonly numberRange: SourceRange;
  readonly bodyRange: SourceRange;
}

export interface InvalidPhysicalLine extends PhysicalLineBase {
  readonly kind: "invalid";
  readonly bodyRange: SourceRange;
}

export type PhysicalLine = BlankPhysicalLine | NumberedPhysicalLine | InvalidPhysicalLine;

export interface PhysicalProgram {
  readonly kind: "physical-program";
  readonly lines: readonly PhysicalLine[];
}

function isSpace(char: string | undefined): boolean {
  return char === " " || char === "\t";
}

function isDigit(char: string | undefined): boolean {
  return char !== undefined && char >= "0" && char <= "9";
}

/** Scan source headers without parsing, normalizing, or rewriting BASIC bodies. */
export function scanPhysicalLines(source: SourceDocument): ParsedDocument<PhysicalProgram> {
  const lines: PhysicalLine[] = [];
  const diagnostics: Diagnostic[] = [];
  const firstNumbers = new Map<number, SourceRange>();
  const text = source.text;
  const report = (code: string, message: string, range: SourceRange): void => {
    diagnostics.push(createDiagnostic({ code, severity: "error", category: "syntax", message, range }));
  };

  for (let physicalLine = 0; physicalLine < source.lineCount; physicalLine++) {
    const start = source.offsetAt({ line: physicalLine, column: 0 });
    const end = physicalLine + 1 < source.lineCount
      ? source.offsetAt({ line: physicalLine + 1, column: 0 }) : text.length;
    let contentEnd = end;
    if (contentEnd > start && text[contentEnd - 1] === "\n") contentEnd--;
    if (contentEnd > start && text[contentEnd - 1] === "\r") contentEnd--;
    const base: PhysicalLineBase = {
      physicalLine,
      range: source.range(start, end),
      contentRange: source.range(start, contentEnd),
      lineEndingRange: source.range(contentEnd, end)
    };
    let cursor = start;
    while (cursor < contentEnd && isSpace(text[cursor])) cursor++;
    if (cursor === contentEnd) {
      lines.push(Object.freeze({ ...base, kind: "blank" }));
      continue;
    }

    const numberStart = cursor;
    while (cursor < contentEnd && isDigit(text[cursor])) cursor++;
    const numberEnd = cursor;
    if (numberEnd === numberStart || (cursor < contentEnd && !isSpace(text[cursor]))) {
      let fieldEnd = cursor;
      while (fieldEnd < contentEnd && !isSpace(text[fieldEnd])) fieldEnd++;
      report(numberEnd === numberStart ? DiagnosticCodes.missingLineNumber : DiagnosticCodes.invalidLineNumber,
        numberEnd === numberStart ? "Expected an explicit decimal BASIC line number."
          : "Separate the decimal BASIC line number from its body with a space or tab.",
        source.range(numberStart, fieldEnd));
      lines.push(Object.freeze({ ...base, kind: "invalid", bodyRange: source.range(numberStart, contentEnd) }));
      continue;
    }
    const numberRange = source.range(numberStart, numberEnd);
    const lineNumber = Number(text.slice(numberStart, numberEnd));
    while (cursor < contentEnd && isSpace(text[cursor])) cursor++;
    const bodyRange = source.range(cursor, contentEnd);
    // Digit-only values inside this bound are exact integers, even with leading zeros.
    if (lineNumber < 1 || lineNumber > 9999 || !Number.isInteger(lineNumber)) {
      report(DiagnosticCodes.invalidLineNumber, "Stored BASIC line numbers must be integers from 1 through 9999.", numberRange);
      lines.push(Object.freeze({ ...base, kind: "invalid", bodyRange }));
      continue;
    }
    lines.push(Object.freeze({ ...base, kind: "numbered", lineNumber, numberRange, bodyRange }));
    const first = firstNumbers.get(lineNumber);
    if (first !== undefined) {
      diagnostics.push(createDiagnostic({
        code: DiagnosticCodes.duplicateLineNumber,
        severity: "error",
        category: "syntax",
        message: `Duplicate BASIC line number ${lineNumber}.`,
        range: numberRange,
        related: [{ message: "First occurrence of this line number.", range: first }]
      }));
    } else firstNumbers.set(lineNumber, numberRange);
    if (cursor === contentEnd) {
      report(DiagnosticCodes.missingStatement, "Expected a BASIC statement after the line number.", bodyRange);
    }
  }

  return Object.freeze({
    source,
    syntax: Object.freeze({ kind: "physical-program", lines: Object.freeze(lines) }),
    diagnostics: Object.freeze(diagnostics)
  });
}
