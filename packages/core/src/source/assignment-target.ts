import type { SourceRange } from "./document.js";
import type { VariableIdentity } from "./variable-identity.js";

/** Shared scalar target. Array and slice forms will extend the target union. */
export interface ScalarAssignmentTarget {
  readonly kind: "scalar-target";
  readonly range: SourceRange;
  readonly identity: VariableIdentity;
}
