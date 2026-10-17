import { SourceRange } from "./document.js";

export type DiagnosticSeverity = "error" | "warning" | "information" | "hint";
export type DiagnosticCategory = "syntax" | "compatibility" | "semantic" | "tooling";

/** Codes identify diagnostic kinds, independent of localized/rendered messages. */
export const DiagnosticCodes = Object.freeze({
  missingLineNumber: "ZX1001",
  invalidLineNumber: "ZX1002",
  duplicateLineNumber: "ZX1003",
  unexpectedToken: "ZX1101",
  missingStatement: "ZX1102",
  unterminatedString: "ZX1103",
  invalidNumericLiteral: "ZX1104",
  invalidVariableName: "ZX1105",
  unsupportedCharacter: "ZX2001",
  unsupportedSyntax: "ZX2002",
  numericOverflow: "ZX2003",
  programTooLarge: "ZX2004",
  missingLineTarget: "ZX3001"
} as const);

export interface DiagnosticRelatedInformation {
  readonly message: string;
  readonly range: SourceRange;
}

export interface Diagnostic {
  readonly code: string;
  readonly severity: DiagnosticSeverity;
  readonly category: DiagnosticCategory;
  readonly message: string;
  readonly range: SourceRange;
  readonly related?: readonly DiagnosticRelatedInformation[];
  readonly capability?: string;
}

function checkRange(range: SourceRange): void {
  if (!(range instanceof SourceRange)) throw new TypeError("Diagnostic requires a checked source range.");
}

export function createDiagnostic(input: Diagnostic): Diagnostic {
  if (!/^ZX\d{4}$/.test(input.code)) throw new TypeError("Diagnostic code must have the form ZX followed by four digits.");
  if (!["error", "warning", "information", "hint"].includes(input.severity)) throw new TypeError("Invalid diagnostic severity.");
  if (!["syntax", "compatibility", "semantic", "tooling"].includes(input.category)) throw new TypeError("Invalid diagnostic category.");
  if (input.message.length === 0) throw new TypeError("Diagnostic message must not be empty.");
  checkRange(input.range);
  const related = input.related?.map((item) => {
    checkRange(item.range);
    return Object.freeze({ message: item.message, range: item.range });
  });
  return Object.freeze({
    code: input.code,
    severity: input.severity,
    category: input.category,
    message: input.message,
    range: input.range,
    ...(related === undefined ? {} : { related: Object.freeze(related) }),
    ...(input.capability === undefined ? {} : { capability: input.capability })
  });
}
