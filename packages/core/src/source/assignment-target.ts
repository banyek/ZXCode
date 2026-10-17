import type { AccessGroup } from "./access.js";
import type { SourceRange } from "./document.js";
import type { VariableIdentity } from "./variable-identity.js";

/** Shared scalar target. Array and slice forms will extend the target union. */
export interface ScalarAssignmentTarget {
  readonly kind: "scalar-target";
  readonly range: SourceRange;
  readonly identity: VariableIdentity;
}

export interface IndexedAssignmentTarget<TExpression> {
  readonly kind: "indexed-target";
  readonly range: SourceRange;
  readonly nameRange: SourceRange;
  readonly identity: VariableIdentity;
  readonly groups: readonly AccessGroup<TExpression>[];
}
export type AssignableTarget<TExpression> = ScalarAssignmentTarget | IndexedAssignmentTarget<TExpression>;
