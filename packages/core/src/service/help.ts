import { languageHelp } from "../source/language-help.js";
import type { LanguageHelpEntry } from "../source/language-help.js";
import type { Statement } from "../syntax/parser.js";
import type { DocumentAnalysisSnapshot, LanguageDocumentation } from "./contract.js";
import type { SourceRange } from "../source/document.js";
const documentation = new Map<LanguageHelpEntry, LanguageDocumentation>();
export function helpDocumentation(entry: LanguageHelpEntry): LanguageDocumentation {
  const previous = documentation.get(entry);
  if (previous !== undefined) return previous;
  const result = Object.freeze({ summary: entry.summary, syntax: entry.syntax, links: entry.links, ...(entry.remarks === undefined ? {} : {remarks: entry.remarks}) });
  documentation.set(entry, result);
  return result;
}
/** Command spans come from CST kinds; raw text/strings never become keyword hover. */
export function tokenHelpAt(snapshot: DocumentAnalysisSnapshot, offset: number): { readonly range: SourceRange; readonly entry: LanguageHelpEntry } | undefined {
  snapshot.source.positionAt(offset);
  const line = snapshot.parsed.syntax.lines.find((item) => item.contentRange.start <= offset && offset <= item.contentRange.end);
  if (line?.kind !== "numbered") return undefined;
  const tokens = line.tokens.filter((token) => token.kind !== "whitespace" && token.kind !== "eof");
  const pending: Statement[] = [...line.statements].reverse();
  while (pending.length !== 0) {
    const node = pending.pop()!;
    if (node.kind === "if") pending.push(...[...node.thenStatements].reverse());
    const spelling = node.kind === "goto" ? "GO TO" : node.kind === "gosub" ? "GO SUB" : node.kind === "def-fn" ? "DEF FN" : node.kind === "simple-command" ? node.definition.token.spelling : node.kind === "cassette" ? node.command : node.kind.toUpperCase();
    const entry = languageHelp(spelling);
    if (entry === undefined) continue;
    const words = spelling.split(" ");
    const head = tokens.filter((token) => token.range.start >= node.range.start).slice(0, words.length);
    if (head.length !== words.length || head.some((token,index) => token.text.toUpperCase() !== words[index])) continue;
    const start = head[0]!.range.start, end = head.at(-1)!.range.end;
    if (start <= offset && offset <= end) return Object.freeze({entry,range:snapshot.source.range(start,end)});
  }
  const token = tokens.find((item) => item.range.start <= offset && offset < item.range.end) ?? tokens.find((item) => item.range.end === offset);
  if (token?.kind !== "word" && token?.kind !== "punctuation") return undefined;
  const entry = token.romToken === undefined ? undefined : languageHelp(token.romToken.spelling);
  return entry === undefined ? undefined : Object.freeze({ entry, range: token.range });
}
