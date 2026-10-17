import { languageHelp } from "../source/language-help.js";
import { helpDocumentation } from "./help.js";
import { parserCompletionContext } from "../syntax/completion-context.js";
import { ROM_TOKENS } from "../source/rom-tokens.js";
import { commandAvailability } from "../source/target-profile.js";
import { BUILTIN_SIGNATURES } from "../semantic/expression.js";
import { documentSymbolIndex } from "./symbol-index.js";
import type { BasicStatement } from "../semantic/program.js";
import type { DocumentAnalysisSnapshot, LanguageCompletionItem, LanguageCompletionList, LanguageQueryResult, CompletionContext } from "./contract.js";
const cache = new WeakMap<DocumentAnalysisSnapshot, Map<number, LanguageQueryResult<LanguageCompletionList>>>();
const fold = (text: string): string => text.replace(/[a-z]/g, (letter) => letter.toUpperCase());
/** Contextual plain-text edits over shared parser state and canonical semantic identities. */
export function documentCompletions(snapshot: DocumentAnalysisSnapshot, offset: number): LanguageQueryResult<LanguageCompletionList> {
  const previous = cache.get(snapshot)?.get(offset);
  if (previous !== undefined) return previous;
  const state = parserCompletionContext(snapshot.parsed, offset);
  const index = documentSymbolIndex(snapshot).value;
  let expected = state.expectedType;
  if (state.functionArgument !== undefined && !state.functionName) {
    const argument = state.functionArgument;
    if (!argument.user) {
      const type = BUILTIN_SIGNATURES.find((item) => item.token.spelling === argument.name)?.arguments[argument.index];
      expected = type === "numeric" || type === "string" ? type : undefined;
    } else {
      const pending: BasicStatement[] = snapshot.analysis.analysis.program.lines.flatMap((line) => line.statements).reverse();
      while (pending.length !== 0) {
        const node = pending.pop()!;
        if (node.kind === "if") pending.push(...[...node.thenStatements].reverse());
        if (node.kind === "def-fn" && node.identity.canonicalName === argument.name) { expected = node.parameters[argument.index]?.identity.valueType; break; }
      }
    }
  }
  const items: LanguageCompletionItem[] = [];
  const seen = new Set<string>();
  const add = (label: string, kind: LanguageCompletionItem["kind"], newText = label, rank = "2", alias = label): void => {
    if (!fold(alias).startsWith(fold(state.prefix)) || seen.has(`${kind}:${label}`)) return;
    seen.add(`${kind}:${label}`);
    const help = languageHelp(label) ?? (label.startsWith("FN ") ? languageHelp("FN") : undefined);
    items.push(Object.freeze({ label, kind, ...(help === undefined ? {} : { detail: help.syntax[0]!, documentation: helpDocumentation(help) }), edit: Object.freeze({ range: state.editRange, newText }), sortKey: `${rank}:${label}` }));
  };
  if (state.kind === "statement-start") {
    for (const token of ROM_TOKENS) if (token.category === "statement" && commandAvailability(token.spelling, snapshot.targetProfile)?.defaultCompletion) add(token.spelling, "command");
  } else if (state.kind !== "string" && state.kind !== "rem" && state.kind !== "line-number" && state.kind !== "unknown") {
    for (const keyword of state.keywords) add(keyword, "keyword", keyword, "1");
    if (state.kind === "expression" || state.kind === "statement-argument" && (state.command === "LET" || state.command === "FOR")) {
      if (state.lineTargets) for (const symbol of index.symbols) if (symbol.kinds.includes("line") && symbol.occurrences.some((item) => item.role === "definition")) add(symbol.name, "line-number", symbol.name, `0:${symbol.name.padStart(4, "0")}`);
      const target = state.kind === "statement-argument";
      if (!target && !state.functionName) {
        for (const signature of BUILTIN_SIGNATURES) if (expected === undefined || signature.result === expected) add(signature.token.spelling, "function", signature.token.spelling + (signature.arguments.length === 2 ? "(" : signature.arguments.length === 0 ? "" : " "));
        if (expected !== "string") { add("BIN", "keyword", "BIN "); add("NOT", "keyword", "NOT "); }
      }
      const formalRanges = state.statement?.kind === "def-fn" ? state.statement.parameters.map((item) => item.range) : [];
      const locals = index.symbols.filter((symbol) => symbol.kinds.includes("parameter") && symbol.occurrences.some((item) => item.role === "definition" && formalRanges.some((range) => range.start === item.range.start && range.end === item.range.end)));
      const localIdentities = state.statement?.kind === "def-fn" ? state.statement.parameters.flatMap((item) => item.identity === undefined ? [] : [item.identity]) : [];
      if (!state.functionName) for (const identity of localIdentities) if (expected === undefined || identity.valueType === expected) add(identity.canonicalName, "variable");
      for (const symbol of index.symbols) {
        if (symbol.identity === undefined || expected !== undefined && symbol.identity.valueType !== expected) continue;
        if (symbol.kinds.includes("parameter") && !locals.includes(symbol)) continue;
        if (!symbol.kinds.includes("parameter") && localIdentities.some((local) => local.canonicalName === symbol.name)) continue;
        if (symbol.kinds.includes("function")) {
          if (!target) add(`FN ${symbol.name}`, "function", `${state.functionName ? "" : "FN "}${symbol.name}(`, "2", state.functionName ? symbol.name : `FN ${symbol.name}`);
        } else if (!state.functionName) {
          if (state.command === "FOR" && target && (symbol.identity.family !== "numeric" || symbol.name.length !== 1)) continue;
          const array = symbol.kinds.includes("array") && !symbol.kinds.includes("variable");
          add(symbol.name + (array ? "()" : ""), array ? "array" : "variable", symbol.name + (array ? "(" : ""));
        }
      }
    }
  }
  items.sort((a, b) => a.sortKey! < b.sortKey! ? -1 : a.sortKey! > b.sortKey! ? 1 : 0);
  const context: CompletionContext = Object.freeze({ kind: state.kind, ...(expected === undefined ? {} : { expectedType: expected }), ...(state.command === undefined ? {} : { command: state.command }) });
  const value = Object.freeze({ context, items: Object.freeze(items), isIncomplete: false });
  const result = Object.freeze({ snapshot: snapshot.identity, value });
  let snapshotCache = cache.get(snapshot);
  if (snapshotCache === undefined) { snapshotCache = new Map(); cache.set(snapshot, snapshotCache); }
  snapshotCache.set(offset, result);
  return result;
}
