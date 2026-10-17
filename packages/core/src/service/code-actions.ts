import { checkProgram } from "../build.js";
import { SourceDocument } from "../source/document.js";
import type { SourceRange } from "../source/document.js";
import { DiagnosticCodes } from "../source/diagnostic.js";
import type { Diagnostic } from "../source/diagnostic.js";
import { documentDiagnostics } from "./diagnostics.js";
import type { DocumentAnalysisSnapshot, LanguageQueryResult, LanguageCodeAction, LanguageTextEdit } from "./contract.js";

export function documentCodeActions(snapshot:DocumentAnalysisSnapshot, range?:SourceRange):LanguageQueryResult<readonly LanguageCodeAction[]> {
  if (range !== undefined) snapshot.source.textInRange(range);
  const diagnostics = documentDiagnostics(snapshot).value;
  const candidates:{edit:LanguageTextEdit;diagnostic:Diagnostic}[] = [];
  for (const line of snapshot.parsed.syntax.lines) {
    if (line.kind !== "invalid") continue;
    const diagnostic = diagnostics.find(d => d.code === DiagnosticCodes.invalidLineNumber && d.range.start === line.bodyRange.start);
    if (diagnostic === undefined) continue;
    const match = /^(\d+)(?=[A-Za-z])/.exec(snapshot.source.textInRange(line.bodyRange));
    if (match === null || Number(match[1]) < 1 || Number(match[1]) > 9999) continue;
    const offset = line.bodyRange.start+match[1]!.length;
    candidates.push({edit:Object.freeze({range:snapshot.source.range(offset,offset),newText:" "}),diagnostic});
  }
  const actions:LanguageCodeAction[] = [];
  const offer = (items:readonly typeof candidates[number][]):void => {
    if (range !== undefined && !items.some(item => item.diagnostic.range.start <= range.end && item.diagnostic.range.end >= range.start)) return;
    let text = snapshot.source.text;
    for (const {edit} of items.toReversed()) text=text.slice(0,edit.range.start)+edit.newText+text.slice(edit.range.end);
    if (checkProgram(new SourceDocument(snapshot.source.id,text),{targetProfile:snapshot.targetProfile}).kind === "error") return;
    actions.push(Object.freeze({id:items.length === 1 ? "zxcode.insert-line-separator" : "zxcode.insert-line-separators",kind:"quickfix",title:items.length === 1 ? "Insert space after BASIC line number" : `Insert spaces after ${items.length} BASIC line numbers`,diagnostics:Object.freeze(items.map(item=>item.diagnostic)),edits:Object.freeze(items.map(item=>item.edit)),resultText:text}));
  };
  // With multiple broken headers, no individual insertion can validate the
  // complete program. Validate the single atomic family plan just once.
  if (candidates.length > 0) offer(candidates);
  return Object.freeze({snapshot:snapshot.identity,value:Object.freeze(actions)});
}
