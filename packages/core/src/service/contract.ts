import type { SourceDocument, SourceRange } from "../source/document.js";
import type { Diagnostic } from "../source/diagnostic.js";
import type { TargetProfile } from "../source/target-profile.js";
import type { ParsedDocument } from "../syntax/document.js";
import type { BasicSyntaxProgram } from "../syntax/parser.js";
import type { BasicAnalysisResult } from "../semantic/program.js";

export interface LanguageDocumentInput {
  readonly source: SourceDocument;
  /** Nonnegative safe integer; replacements must increase within a session. */
  readonly version: number;
}
export interface DocumentSnapshotIdentity extends LanguageDocumentInput {
  readonly documentId: string;
}
/** Invalid/incomplete analysis is first-class; no buildable requirement here. */
export interface DocumentAnalysisSnapshot {
  readonly identity: DocumentSnapshotIdentity;
  readonly source: SourceDocument;
  readonly targetProfile: TargetProfile;
  readonly parsed: ParsedDocument<BasicSyntaxProgram>;
  readonly analysis: BasicAnalysisResult;
}
export interface DocumentSessionOptions { readonly targetProfile?: TargetProfile }
export interface DocumentAnalysisSession {
  readonly current: DocumentAnalysisSnapshot;
  update(input: LanguageDocumentInput): DocumentAnalysisSnapshot;
}
export interface LanguageQueryResult<T> {
  /** Exactly the queried snapshot's identity, including the immutable source. */
  readonly snapshot: DocumentSnapshotIdentity;
  readonly value: T;
}
export interface DocumentationLink { readonly label: string; readonly url: string }
export interface LanguageDocumentation {
  readonly summary: string;
  readonly syntax?: readonly string[];
  readonly remarks?: readonly string[];
  readonly links?: readonly DocumentationLink[];
}
export interface LanguageTextEdit { readonly range: SourceRange; readonly newText: string }
export interface CompletionContext {
  readonly kind: "statement-start" | "expression" | "statement-argument" | "string" | "rem" | "line-number" | "unknown";
  readonly expectedType?: "numeric" | "string";
  readonly command?: string;
}
export interface LanguageCompletionItem {
  readonly label: string;
  readonly kind: "command" | "function" | "keyword" | "variable" | "array" | "line-number" | "escape";
  readonly edit: LanguageTextEdit;
  readonly detail?: string;
  readonly documentation?: LanguageDocumentation;
  readonly sortKey?: string;
}
export interface LanguageCompletionList {
  readonly context: CompletionContext;
  readonly items: readonly LanguageCompletionItem[];
  readonly isIncomplete: boolean;
}
export interface LanguageHover {
  readonly range: SourceRange;
  readonly documentation: LanguageDocumentation;
}
export type LanguageSymbolKind = "line" | "variable" | "array" | "function" | "parameter";
export interface LanguageSymbol {
  /** Canonical family/scope identity, stable only within the queried snapshot. */
  readonly key: string;
  readonly name: string;
  readonly kind: LanguageSymbolKind;
  readonly range: SourceRange;
  readonly selectionRange: SourceRange;
  readonly detail?: string;
  readonly children?: readonly LanguageSymbol[];
}
export interface LanguageSignatureParameter {
  readonly label: string;
  readonly documentation?: LanguageDocumentation;
}
export interface LanguageSignature {
  readonly label: string;
  readonly parameters: readonly LanguageSignatureParameter[];
  readonly documentation?: LanguageDocumentation;
}
export interface LanguageSignatureHelp {
  readonly signatures: readonly LanguageSignature[];
  readonly activeSignature: number;
  readonly activeParameter: number;
}
export interface LanguageReferenceOptions { readonly includeDeclaration?: boolean }
/** Synchronous host-independent queries. Offset arguments are checked UTF-16 offsets. */
export interface LanguageServiceQueries {
  codeActions(snapshot: DocumentAnalysisSnapshot, range?: SourceRange): LanguageQueryResult<readonly LanguageCodeAction[]>;
  diagnostics(snapshot: DocumentAnalysisSnapshot): LanguageQueryResult<readonly Diagnostic[]>;
  completions(snapshot: DocumentAnalysisSnapshot, offset: number): LanguageQueryResult<LanguageCompletionList>;
  hover(snapshot: DocumentAnalysisSnapshot, offset: number): LanguageQueryResult<LanguageHover | undefined>;
  definitions(snapshot: DocumentAnalysisSnapshot, offset: number): LanguageQueryResult<readonly SourceRange[]>;
  references(snapshot: DocumentAnalysisSnapshot, offset: number, options?: LanguageReferenceOptions): LanguageQueryResult<readonly SourceRange[]>;
  symbols(snapshot: DocumentAnalysisSnapshot): LanguageQueryResult<readonly LanguageSymbol[]>;
  signatureHelp(snapshot: DocumentAnalysisSnapshot, offset: number): LanguageQueryResult<LanguageSignatureHelp | undefined>;
}

export interface LanguageCodeAction {
  readonly id:"zxcode.insert-line-separator" | "zxcode.insert-line-separators";
  readonly kind:"quickfix";
  readonly title:string;
  readonly diagnostics:readonly Diagnostic[];
  readonly edits:readonly LanguageTextEdit[];
  readonly resultText:string;
}
