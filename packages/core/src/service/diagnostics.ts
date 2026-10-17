import { encodeBasicProgram, EncodingError } from "../encoding/basic.js";
import type { Diagnostic } from "../source/diagnostic.js";
import type { DocumentAnalysisSnapshot, LanguageQueryResult } from "./contract.js";

const cache = new WeakMap<DocumentAnalysisSnapshot, LanguageQueryResult<readonly Diagnostic[]>>();
/** Shared parser/semantic/encoding diagnostics; no host formatting or alternate checks. */
export function documentDiagnostics(snapshot: DocumentAnalysisSnapshot): LanguageQueryResult<readonly Diagnostic[]> {
  const previous = cache.get(snapshot);
  if (previous !== undefined) return previous;
  let diagnostics = snapshot.analysis.analysis.diagnostics;
  if (snapshot.analysis.kind === "buildable") {
    try { encodeBasicProgram(snapshot.analysis.analysis); }
    catch (error) {
      if (!(error instanceof EncodingError)) throw error;
      diagnostics = Object.freeze([...diagnostics, error.diagnostic]);
    }
  }
  const result = Object.freeze({ snapshot: snapshot.identity, value: diagnostics });
  cache.set(snapshot, result);
  return result;
}
