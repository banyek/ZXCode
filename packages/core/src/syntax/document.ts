import type { Diagnostic } from "../source/diagnostic.js";
import type { SourceDocument } from "../source/document.js";

/** Recoverable parser output; the syntax tree may contain incomplete/error nodes. */
export interface ParsedDocument<TSyntax> {
  readonly source: SourceDocument;
  readonly syntax: TSyntax;
  readonly diagnostics: readonly Diagnostic[];
}
