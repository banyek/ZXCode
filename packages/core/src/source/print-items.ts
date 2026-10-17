import type { SourceRange } from "./document.js";
import type { RomToken } from "./rom-tokens.js";

export type PrintItem<TExpression> =
  | { readonly kind: "print-expression"; readonly range: SourceRange; readonly expression: TExpression }
  | { readonly kind: "print-separator"; readonly range: SourceRange; readonly separator: ";" | "," | "'" }
  | { readonly kind: "print-empty"; readonly range: SourceRange }
  | { readonly kind: "print-at"; readonly range: SourceRange; readonly row: TExpression; readonly column: TExpression; readonly complete: boolean }
  | { readonly kind: "print-tab"; readonly range: SourceRange; readonly column: TExpression }
  | { readonly kind: "print-control"; readonly range: SourceRange; readonly token: RomToken; readonly expression: TExpression }
  | { readonly kind: "print-channel"; readonly range: SourceRange; readonly stream: TExpression };
export interface PrintStatement<TExpression> {
  readonly kind: "print" | "lprint";
  readonly range: SourceRange;
  readonly items: readonly PrintItem<TExpression>[];
  readonly complete: boolean;
}
