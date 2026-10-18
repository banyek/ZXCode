import type { SourceRange } from "../source/document.js";
import type { LanguageQueryResult, LanguageTextEdit } from "../service/contract.js";
export interface RenumberOptions {
  readonly fromLine?:number;
  readonly throughLine?:number;
  readonly start?:number;
  readonly step?:number;
}
export type RenumberCommand = "GO TO" | "GO SUB" | "RUN" | "RESTORE" | "LIST" | "LLIST" | "SAVE LINE";
export interface RenumberLineChange {readonly from:number;readonly to:number;readonly range:SourceRange}
export interface RenumberReference {
  readonly command:RenumberCommand;
  readonly range:SourceRange;
  readonly fromValue:number;
  readonly toValue:number;
  readonly resolution:"exact" | "following" | "start" | "end";
  readonly resolvedOldLine?:number;
}
export type RenumberIssueCode = "invalid-options" | "invalid-program" | "collision" | "order-change" | "unproven-reference" | "unsupported-reference" | "end-target-captured" | "result-invalid" | "stale-preview";
export interface RenumberIssue {readonly code:RenumberIssueCode;readonly message:string;readonly range?:SourceRange}
export interface RenumberBlocked {readonly kind:"blocked";readonly issues:readonly RenumberIssue[]}
export interface RenumberPreview {
  readonly kind:"preview";
  readonly guarantee:"literal-line-destinations";
  readonly lines:readonly RenumberLineChange[];
  readonly references:readonly RenumberReference[];
  readonly edits:readonly LanguageTextEdit[];
  readonly resultText:string;
  readonly notes:readonly string[];
}
export type RenumberResult = LanguageQueryResult<RenumberPreview | RenumberBlocked>;
export type RenumberApplyResult = {readonly kind:"success";readonly text:string;readonly edits:readonly LanguageTextEdit[]} | RenumberBlocked;
