import type { SourceRange } from "./document.js";
/** Internal text data, independent of any source escape spelling. */
export type SpectrumTextAtom =
  | { readonly kind: "text"; readonly value: string }
  | { readonly kind: "control"; readonly name: string; readonly parameters: readonly number[] }
  | { readonly kind: "byte"; readonly value: number };
export interface SpectrumTextIssue {
  readonly code: "unrepresentable-character" | "unknown-control" | "invalid-parameters" | "invalid-byte" | "unrepresentable-string-byte";
  readonly message: string;
  readonly itemIndex: number;
  /** UTF-16 offset/width within a literal text atom; zero for structured atoms. */
  readonly offset: number;
  readonly length: number;
  readonly parameterIndex?: number;
}
export interface SpectrumTextDecodeIssue {
  readonly code: "truncated-control";
  readonly offset: number;
  readonly length: number;
  readonly name: string;
  readonly requiredParameters: number;
  readonly availableParameters: number;
}

export type SourceTextContext = "string" | "rem";
export type SourceTextPart =
  | { readonly kind: "text"; readonly value: string; readonly range: SourceRange }
  | { readonly kind: "atom"; readonly atom: SpectrumTextAtom; readonly range: SourceRange }
  | { readonly kind: "error"; readonly message: string; readonly range: SourceRange };
export function sourceTextValue(parts: readonly SourceTextPart[]): string | undefined {
  if (parts.some((part) => part.kind !== "text")) return undefined;
  return parts.map((part) => part.kind === "text" ? part.value : "").join("");
}
