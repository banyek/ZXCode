import type { SourceRange } from "./document.js";
import type { PrintContentItem, PrintItem } from "./print-items.js";

export type InputItem<TExpression, TTarget> =
  | { readonly kind: "input-target"; readonly range: SourceRange; readonly target: TTarget; readonly lineMode: boolean }
  | { readonly kind: "input-display"; readonly range: SourceRange; readonly item: PrintContentItem<TExpression> }
  | { readonly kind: "input-group"; readonly range: SourceRange; readonly items: readonly PrintItem<TExpression>[]; readonly complete: boolean }
  | { readonly kind: "input-separator"; readonly range: SourceRange; readonly separator: ";" | "," | "'" }
  | { readonly kind: "input-empty"; readonly range: SourceRange };
export interface InputStatement<TExpression, TTarget> {
  readonly kind: "input";
  readonly range: SourceRange;
  readonly items: readonly InputItem<TExpression, TTarget>[];
  readonly complete: boolean;
}
