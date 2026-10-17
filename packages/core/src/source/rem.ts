import type { SourceRange } from "./document.js";
export interface RemStatement {
  readonly kind: "rem";
  readonly range: SourceRange;
  readonly tailRange: SourceRange;
  readonly text: string;
}
