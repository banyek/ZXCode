import { createDiagnostic, DiagnosticCodes } from "../source/diagnostic.js";
import type { Diagnostic } from "../source/diagnostic.js";
import type { SourceRange } from "../source/document.js";
import type { AccessGroup } from "../source/access.js";
import { identifyVariable } from "../source/variable-identity.js";
import type { TypedExpression } from "./expression.js";

/** One access validator for expression reads and named assignment targets. */
export function validateAccess(base: TypedExpression, group: AccessGroup<TypedExpression>, range: SourceRange, diagnostics: Diagnostic[], numeric: (expression: TypedExpression) => boolean): TypedExpression | undefined {
  let valid = group.complete && group.closed;
  const report = (message: string): void => {
    valid = false;
    if (!diagnostics.some((item) => item.severity === "error" && item.range.sourceId === range.sourceId && item.range.start >= group.range.start && item.range.end <= group.range.end)) diagnostics.push(createDiagnostic({ code: DiagnosticCodes.unexpectedToken, severity: "error", category: "syntax", message, range: group.range }));
  };
  if (!valid) report("Subscript/slice group is incomplete.");
  if (base.type === "error" || base.type === "unknown") return undefined;
  let named = base;
  if (base.type === "numeric") {
    const identity = base.kind === "name" ? identifyVariable(base.identity.sourceName, "numeric-array") : undefined;
    if (identity?.kind !== "success") report("Numeric array access requires a single-letter array name.");
    else named = Object.freeze({ kind: "name", type: base.type, range: base.range, identity: identity.identity });
    if (group.selectors.length === 0 || group.selectors.some((selector) => selector.kind !== "index")) report("Numeric arrays require numeric subscripts, not empty/TO slices.");
  } else if (base.type === "string") {
    if (base.kind !== "name" && group.selectors.length > 1) report("A string value accepts only one slice/index selector.");
    if (base.kind === "name" && group.selectors.length > 1) {
      const identity = identifyVariable(base.identity.sourceName, "string-array");
      if (identity.kind !== "success") report("String array names require one letter followed by '$'.");
      else named = Object.freeze({ ...base, identity: identity.identity });
    }
  }
  for (let index = 0; index < group.selectors.length; index++) {
    const selector = group.selectors[index]!;
    if (selector.kind === "index") { if (!numeric(selector.expression)) valid = false; }
    else {
      if (index !== group.selectors.length - 1) report("A string slice must be the final selector.");
      if (!selector.hasTo && (selector.from !== undefined || selector.to !== undefined)) report("Invalid whole-string slice form.");
      if (selector.from !== undefined && !numeric(selector.from)) valid = false;
      if (selector.to !== undefined && !numeric(selector.to)) valid = false;
    }
  }
  return valid ? Object.freeze({ kind: base.type === "numeric" ? "array-access" : "string-access", range, type: base.type, base: named, group }) : undefined;
}
