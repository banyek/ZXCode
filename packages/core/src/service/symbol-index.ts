import { SourceRange } from "../source/document.js";
import type { VariableIdentity } from "../source/variable-identity.js";
import type { DocumentAnalysisSnapshot, LanguageQueryResult, LanguageSymbolKind } from "./contract.js";

export interface SymbolOccurrence {
  readonly key: string;
  readonly range: SourceRange;
  readonly role: "definition" | "write" | "read";
  readonly definitionRange?: SourceRange;
}
export interface IndexedSymbol {
  readonly key: string;
  readonly name: string;
  readonly kinds: readonly LanguageSymbolKind[];
  readonly identity?: VariableIdentity;
  readonly occurrences: readonly SymbolOccurrence[];
}
export interface SemanticSymbolIndex {
  readonly symbols: readonly IndexedSymbol[];
  readonly occurrences: readonly SymbolOccurrence[];
  get(key: string): IndexedSymbol | undefined;
  at(offset: number): SymbolOccurrence | undefined;
}
const cache = new WeakMap<DocumentAnalysisSnapshot, LanguageQueryResult<SemanticSymbolIndex>>();
interface MutableSymbol { key: string; name: string; identity?: VariableIdentity; kinds: Set<LanguageSymbolKind>; occurrences: SymbolOccurrence[] }
interface Work { node: unknown; targetRole: "write" | "read"; formal: boolean; cassetteCommand?: string }
/** Walk shared semantic identities, never source spellings or keyword-looking text. */
export function documentSymbolIndex(snapshot: DocumentAnalysisSnapshot): LanguageQueryResult<SemanticSymbolIndex> {
  const previous = cache.get(snapshot);
  if (previous !== undefined) return previous;
  const records = new Map<string, MutableSymbol>();
  const occurrences: SymbolOccurrence[] = [];
  const add = (key: string, name: string, kind: LanguageSymbolKind, range: SourceRange, role: SymbolOccurrence["role"], identity?: VariableIdentity, definitionRange?: SourceRange): void => {
    let record = records.get(key);
    if (record === undefined) {
      record = { key, name, kinds: new Set(), occurrences: [], ...(identity === undefined ? {} : { identity }) };
      records.set(key, record);
    }
    record.kinds.add(kind);
    if (record.occurrences.some((item) => item.range.start === range.start && item.range.end === range.end && item.role === role)) return;
    const occurrence = Object.freeze({ key, range, role, ...(definitionRange === undefined ? {} : { definitionRange }) });
    record.occurrences.push(occurrence);
    occurrences.push(occurrence);
  };
  for (const line of snapshot.analysis.analysis.program.lines) {
    if (Number.isInteger(line.lineNumber) && line.lineNumber >= 1 && line.lineNumber <= 9999) add(`line:${line.lineNumber}`, String(line.lineNumber), "line", line.numberRange, "definition");
    const pending: Work[] = line.statements.map((node) => ({ node, targetRole: "write", formal: false }));
    while (pending.length !== 0) {
      const work = pending.pop()!;
      if (work.node === null || typeof work.node !== "object" || work.node instanceof SourceRange) continue;
      if (Array.isArray(work.node)) { for (const node of work.node) pending.push({ ...work, node }); continue; }
      const node = work.node as Record<string, unknown>;
      const kind = node.kind;
      const identity = node.identity as VariableIdentity | undefined;
      const range = node.nameRange instanceof SourceRange ? node.nameRange : node.range;
      if (identity !== undefined && range instanceof SourceRange) {
        const symbolKind: LanguageSymbolKind = identity.family === "function" ? "function" : identity.family === "formal" ? "parameter" : identity.category.endsWith("array") ? "array" : "variable";
        const role: SymbolOccurrence["role"] = kind === "def-fn" || kind === "dim" || work.formal ? "definition"
          : kind === "scalar-target" || kind === "indexed-target" ? work.targetRole
          : kind === "array" && work.cassetteCommand === "LOAD" ? "write" : "read";
        add(identity.key, identity.canonicalName, symbolKind, range, role, identity, node.formalRange instanceof SourceRange ? node.formalRange : node.definitionRange instanceof SourceRange ? node.definitionRange : undefined);
      }
      if ((kind === "goto" || kind === "gosub") && node.lineReference !== undefined) {
        const reference = node.lineReference as { lineNumber: number; range: SourceRange; definitionRange?: SourceRange };
        add(`line:${reference.lineNumber}`, String(reference.lineNumber), "line", reference.range, "read", undefined, reference.definitionRange);
      }
      for (const [property, child] of Object.entries(node)) {
        if (property === "identity" || property === "token" || property === "bytes" || child === null || typeof child !== "object" || child instanceof SourceRange) continue;
        pending.push({ node: child, targetRole: kind === "next" && property === "variable" ? "read" : work.targetRole, formal: kind === "def-fn" && property === "parameters", ...(kind === "cassette" ? { cassetteCommand: node.command as string } : work.cassetteCommand === undefined ? {} : { cassetteCommand: work.cassetteCommand }) });
      }
    }
  }
  const order = (a: SymbolOccurrence, b: SymbolOccurrence): number => a.range.start - b.range.start || a.range.end - b.range.end || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0);
  occurrences.sort(order);
  const symbols: readonly IndexedSymbol[] = Object.freeze([...records.values()].sort((a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0).map((record) => Object.freeze({ key: record.key, name: record.name, kinds: Object.freeze([...record.kinds].sort()), occurrences: Object.freeze(record.occurrences.sort(order)), ...(record.identity === undefined ? {} : { identity: record.identity }) })));
  const byKey = new Map(symbols.map((symbol) => [symbol.key, symbol]));
  const frozenOccurrences = Object.freeze(occurrences);
  const index: SemanticSymbolIndex = Object.freeze({
    symbols, occurrences: frozenOccurrences,
    get: (key: string): IndexedSymbol | undefined => byKey.get(key),
    at: (offset: number): SymbolOccurrence | undefined => {
      snapshot.source.positionAt(offset);
      const contains = frozenOccurrences.filter((item) => item.range.start <= offset && offset < item.range.end);
      const candidates = contains.length === 0 ? frozenOccurrences.filter((item) => item.range.end === offset) : contains;
      return candidates.sort((a, b) => (a.range.end - a.range.start) - (b.range.end - b.range.start) || order(a, b))[0];
    }
  });
  const result = Object.freeze({ snapshot: snapshot.identity, value: index });
  cache.set(snapshot, result);
  return result;
}
