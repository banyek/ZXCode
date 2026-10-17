import type { SourceRange } from "./document.js";
import type { VariableIdentity } from "./variable-identity.js";
export interface ListingStatement<T> {
  readonly kind: "list" | "llist";
  readonly range: SourceRange;
  readonly stream?: T;
  readonly separator?: { readonly text: "," | ";"; readonly range: SourceRange };
  readonly startLine?: T;
  readonly complete: boolean;
}
export type CassetteForm<T> =
  | { readonly kind: "program" }
  | { readonly kind: "line"; readonly range: SourceRange; readonly line: T }
  | { readonly kind: "screen"; readonly range: SourceRange }
  | { readonly kind: "code"; readonly range: SourceRange; readonly start?: T; readonly length?: T; readonly commaRange?: SourceRange }
  | { readonly kind: "array"; readonly range: SourceRange; readonly nameRange: SourceRange; readonly identity?: VariableIdentity; readonly closed: boolean };
export interface CassetteStatement<T> {
  readonly kind: "cassette";
  readonly command: "SAVE" | "LOAD" | "VERIFY" | "MERGE";
  readonly range: SourceRange;
  readonly filename: T;
  readonly form: CassetteForm<T>;
  readonly complete: boolean;
}
