import type { SourceRange } from "../source/document.js";
import type { VariableIdentity } from "../source/variable-identity.js";
export interface FunctionBinding {
  readonly identity: VariableIdentity;
  readonly range: SourceRange;
  readonly parameters: readonly { readonly identity: VariableIdentity; readonly range: SourceRange }[];
}
export interface FunctionContext {
  readonly definitions: ReadonlyMap<string, FunctionBinding>;
  readonly local?: FunctionBinding;
}
