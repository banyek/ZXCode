import type { SourceRange } from "../source/document.js";
import type { DocumentAnalysisSnapshot, LanguageHover, LanguageQueryResult, LanguageReferenceOptions } from "./contract.js";
import { documentSymbolIndex } from "./symbol-index.js";
import type { IndexedSymbol, SymbolOccurrence } from "./symbol-index.js";

function locate(snapshot: DocumentAnalysisSnapshot, offset: number): { symbol: IndexedSymbol; occurrence: SymbolOccurrence } | undefined {
  const index = documentSymbolIndex(snapshot).value;
  const occurrence = index.at(offset);
  const symbol = occurrence === undefined ? undefined : index.get(occurrence.key);
  return occurrence === undefined || symbol === undefined ? undefined : { symbol, occurrence };
}
function uniqueRanges(ranges: readonly SourceRange[]): readonly SourceRange[] {
  const seen = new Set<string>();
  return Object.freeze(ranges.filter((range) => {
    const key = `${range.start}:${range.end}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }));
}
export function documentDefinitions(snapshot: DocumentAnalysisSnapshot, offset: number): LanguageQueryResult<readonly SourceRange[]> {
  const found = locate(snapshot, offset);
  let ranges: readonly SourceRange[] = [];
  if (found !== undefined) {
    const { symbol, occurrence } = found;
    if (occurrence.definitionRange !== undefined) ranges = [occurrence.definitionRange];
    else if (occurrence.role === "definition") ranges = [occurrence.range];
    else {
      const definitions = symbol.occurrences.filter((item) => item.role === "definition");
      ranges = (definitions.length === 0 ? symbol.occurrences.filter((item) => item.role === "write") : definitions).map((item) => item.range);
    }
  }
  return Object.freeze({ snapshot: snapshot.identity, value: uniqueRanges(ranges) });
}
export function documentReferences(snapshot: DocumentAnalysisSnapshot, offset: number, options: LanguageReferenceOptions = {}): LanguageQueryResult<readonly SourceRange[]> {
  const found = locate(snapshot, offset);
  const ranges = found === undefined ? [] : found.symbol.occurrences.filter((item) => options.includeDeclaration === true || item.role !== "definition").map((item) => item.range);
  return Object.freeze({ snapshot: snapshot.identity, value: uniqueRanges(ranges) });
}
export function documentHover(snapshot: DocumentAnalysisSnapshot, offset: number): LanguageQueryResult<LanguageHover | undefined> {
  const found = locate(snapshot, offset);
  if (found === undefined) return Object.freeze({ snapshot: snapshot.identity, value: undefined });
  const { symbol, occurrence } = found;
  const defined = symbol.occurrences.some((item) => item.role === "definition");
  let summary: string;
  let remarks: readonly string[] | undefined;
  if (symbol.kinds.includes("line")) summary = `BASIC line ${symbol.name}${defined ? "" : " (not present in this document)"}.`;
  else {
    const type = symbol.identity!.valueType;
    const kind = symbol.kinds.includes("function") ? "function" : symbol.kinds.includes("parameter") ? "formal parameter" : symbol.kinds.includes("array") && symbol.kinds.includes("variable") ? "variable / array" : symbol.kinds.includes("array") ? "array" : "variable";
    summary = `${symbol.kinds.includes("function") ? "FN " : ""}${symbol.name}: ${type} ${kind}.`;
    if (symbol.kinds.includes("function") && !defined) remarks = Object.freeze(["No DEF FN definition in this document."]);
  }
  const documentation = Object.freeze({ summary, ...(remarks === undefined ? {} : { remarks }) });
  return Object.freeze({ snapshot: snapshot.identity, value: Object.freeze({ range: occurrence.range, documentation }) });
}
