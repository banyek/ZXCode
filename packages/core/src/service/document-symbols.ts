import type { BasicStatement } from "../semantic/program.js";
import type { BasicDefFnStatement } from "../semantic/functions.js";
import type { SourceRange } from "../source/document.js";
import { documentSymbolIndex } from "./symbol-index.js";
import type { IndexedSymbol, SymbolOccurrence } from "./symbol-index.js";
import type { DocumentAnalysisSnapshot, LanguageQueryResult, LanguageSymbol, LanguageSymbolKind } from "./contract.js";
const cache = new WeakMap<DocumentAnalysisSnapshot, LanguageQueryResult<readonly LanguageSymbol[]>>();
const contains = (outer: SourceRange, inner: SourceRange): boolean => outer.start <= inner.start && inner.end <= outer.end;
/** A physical-source outline, not a module hierarchy or reordered execution listing. */
export function documentSymbols(snapshot: DocumentAnalysisSnapshot): LanguageQueryResult<readonly LanguageSymbol[]> {
  const previous = cache.get(snapshot);
  if (previous !== undefined) return previous;
  const index = documentSymbolIndex(snapshot).value;
  const statements: BasicStatement[] = [];
  const pending = snapshot.analysis.analysis.program.lines.flatMap((line) => line.statements);
  while (pending.length !== 0) {
    const node = pending.pop()!;
    statements.push(node);
    if (node.kind === "if") pending.push(...node.thenStatements);
  }
  const functions = statements.filter((node): node is BasicDefFnStatement => node.kind === "def-fn");
  const outline = (symbol: IndexedSymbol, occurrence: SymbolOccurrence): LanguageSymbol => {
    const owner = statements.filter((node) => contains(node.range,occurrence.range)).sort((a,b) => (a.range.end-a.range.start)-(b.range.end-b.range.start))[0];
    const fn = functions.find((node) => node.nameRange.start === occurrence.range.start && node.nameRange.end === occurrence.range.end);
    const kind: LanguageSymbolKind = fn !== undefined ? "function" : owner?.kind === "dim" || owner?.kind === "cassette" && owner.form.kind === "array" || symbol.identity?.family === "numeric-array" ? "array" : "variable";
    const children = fn?.parameters.map((parameter): LanguageSymbol => Object.freeze({key:parameter.identity.key,name:parameter.identity.canonicalName,kind:"parameter",range:parameter.range,selectionRange:parameter.range,detail:parameter.identity.valueType}));
    return Object.freeze({key:symbol.key,name:symbol.name,kind,range:fn?.range ?? owner?.range ?? occurrence.range,selectionRange:occurrence.range,...(symbol.identity === undefined ? {} : {detail:symbol.identity.valueType}),...(children === undefined ? {} : {children:Object.freeze(children)})});
  };
  const lines: LanguageSymbol[] = [];
  for (const line of snapshot.parsed.syntax.lines) {
    if (line.kind !== "numbered") continue;
    const children: LanguageSymbol[] = [];
    for (const occurrence of index.occurrences) {
      if (occurrence.role === "read" || !contains(line.contentRange,occurrence.range)) continue;
      const symbol = index.get(occurrence.key)!;
      if (symbol.kinds.includes("line") || symbol.kinds.includes("parameter")) continue;
      children.push(outline(symbol,occurrence));
    }
    lines.push(Object.freeze({key:`line:${line.lineNumber}`,name:snapshot.source.textInRange(line.numberRange),kind:"line",range:line.contentRange,selectionRange:line.numberRange,children:Object.freeze(children)}));
  }
  const result = Object.freeze({snapshot:snapshot.identity,value:Object.freeze(lines)});
  cache.set(snapshot,result);
  return result;
}
