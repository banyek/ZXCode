import type { SourceRange } from "./document.js";

export type AccessSelector<TExpression> =
  | { readonly kind: "index"; readonly range: SourceRange; readonly expression: TExpression }
  | { readonly kind: "slice"; readonly range: SourceRange; readonly from?: TExpression; readonly to?: TExpression; readonly hasTo: boolean };
export interface AccessGroup<TExpression> {
  readonly range: SourceRange;
  readonly selectors: readonly AccessSelector<TExpression>[];
  readonly closed: boolean;
  readonly complete: boolean;
}
