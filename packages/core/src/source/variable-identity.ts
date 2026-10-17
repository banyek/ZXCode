/** Name categories describe a use; identity families describe ROM storage/binding. */
export type VariableCategory = "numeric-scalar" | "string-scalar" | "numeric-array" | "string-array" | "for-control" | "function" | "formal";
export interface VariableIdentity {
  readonly sourceName: string;
  readonly canonicalName: string;
  readonly category: VariableCategory;
  readonly valueType: "numeric" | "string";
  readonly family: "numeric" | "numeric-array" | "string" | "function" | "formal";
  /** Local key; a formal's owning definition is supplied by the later binder. */
  readonly key: string;
}
export type VariableIdentityResult =
  | { readonly kind: "success"; readonly identity: VariableIdentity }
  | { readonly kind: "error"; readonly reason: "invalid-name" };

/** Validate original spelling without keyword substitution or Unicode folding. */
export function identifyVariable(sourceName: string, category: VariableCategory): VariableIdentityResult {
  const canonicalName = sourceName.replace(/[ \t]/g, "").replace(/[A-Z]/g, (letter) => letter.toLowerCase());
  const string = canonicalName.endsWith("$");
  const pattern = category === "numeric-scalar" ? /^[a-z][a-z0-9]*$/
    : category === "string-scalar" || category === "string-array" ? /^[a-z]\$$/
    : category === "function" || category === "formal" ? /^[a-z]\$?$/ : /^[a-z]$/;
  if (!pattern.test(canonicalName)) return Object.freeze({ kind: "error", reason: "invalid-name" });
  const family = category === "function" || category === "formal" ? category
    : category === "numeric-array" ? "numeric-array" : string ? "string" : "numeric";
  const identity: VariableIdentity = Object.freeze({ sourceName, canonicalName, category, valueType: string ? "string" : "numeric", family, key: `${family}:${canonicalName}` });
  return Object.freeze({ kind: "success", identity });
}
