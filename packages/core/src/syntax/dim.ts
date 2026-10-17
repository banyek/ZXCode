import { createDiagnostic, DiagnosticCodes } from "../source/diagnostic.js";
import type { Diagnostic } from "../source/diagnostic.js";
import type { SourceDocument, SourceRange } from "../source/document.js";
import { parseAssignableTarget } from "./assignment.js";
import type { AssignmentTarget } from "./assignment.js";
import type { BodyToken } from "./lexer.js";

export interface DimStatement {
  readonly kind: "dim";
  readonly range: SourceRange;
  readonly target: AssignmentTarget;
  readonly complete: boolean;
}
export function parseDimStatement(source: SourceDocument, tokens: readonly BodyToken[], range: SourceRange, diagnostics: Diagnostic[]): DimStatement {
  const body = tokens.slice(1);
  const targetRange = body.length === 0 ? source.range(range.end) : source.range(body[0]!.range.start, range.end);
  const target = parseAssignableTarget(source, body, targetRange, diagnostics);
  const complete = target.kind === "indexed-target" && target.groups.length === 1 && target.groups[0]!.complete && target.groups[0]!.selectors.length > 0 && target.groups[0]!.selectors.every((selector) => selector.kind === "index");
  if (!complete && target.kind !== "error-target") diagnostics.push(createDiagnostic({ code: DiagnosticCodes.unexpectedToken, severity: "error", category: "syntax", message: "DIM requires one nonempty numeric dimension group without TO slices.", range: targetRange }));
  return Object.freeze({ kind: "dim", range, target, complete });
}
