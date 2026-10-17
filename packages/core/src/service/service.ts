import type { LanguageServiceQueries } from "./contract.js";
import { documentDiagnostics } from "./diagnostics.js";
import { documentCompletions } from "./completion.js";
import { documentHover, documentDefinitions, documentReferences } from "./navigation.js";
import { documentSignatureHelp } from "./signatures.js";
import { documentSymbols } from "./document-symbols.js";
/** Complete host-independent query facade; sessions own document/version state. */
export const languageService = Object.freeze({
  diagnostics: documentDiagnostics,
  completions: documentCompletions,
  hover: documentHover,
  definitions: documentDefinitions,
  references: documentReferences,
  symbols: documentSymbols,
  signatureHelp: documentSignatureHelp
}) satisfies LanguageServiceQueries;
