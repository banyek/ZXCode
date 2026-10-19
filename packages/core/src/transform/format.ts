import { checkProgram } from "../build.js";
import { SourceDocument } from "../source/document.js";
import type { DocumentAnalysisSnapshot, LanguageQueryResult, LanguageTextEdit } from "../service/contract.js";
export type FormatResult = LanguageQueryResult<
  {readonly kind:"formatted";readonly guarantee:"identical-basic-bytes";readonly edits:readonly LanguageTextEdit[];readonly resultText:string}
  | {readonly kind:"blocked";readonly reason:"invalid-program" | "result-invalid" | "bytes-changed"}
>;
/** Conservative source whitespace and jump alias normalization, with a mandatory complete binary proof. */
export function formatDocument(snapshot: DocumentAnalysisSnapshot): FormatResult {
  const blocked = (reason:"invalid-program" | "result-invalid" | "bytes-changed"):FormatResult => Object.freeze({snapshot:snapshot.identity,value:Object.freeze({kind:"blocked",reason})});
  const original = checkProgram(snapshot.source,{targetProfile:snapshot.targetProfile});
  if (original.kind === "error") return blocked("invalid-program");
  const edits:LanguageTextEdit[] = [];
  for (const line of snapshot.parsed.syntax.lines) {
    let replacement:string;
    if (line.kind === "blank") replacement = "";
    else if (line.kind === "numbered") {
      let body = "";
      const tokens = line.tokens.filter(token => token.kind !== "eof");
      for (let i=0;i<tokens.length;i++) {
        const token = tokens[i]!;
        if (token.kind === "whitespace") {if (i < tokens.length-1) body += " ";}
        else body += token.kind === "word" && (token.romToken?.spelling === "GO TO" || token.romToken?.spelling === "GO SUB") ? token.romToken.spelling : token.text;
      }
      replacement = snapshot.source.textInRange(line.numberRange)+" "+body;
    } else return blocked("invalid-program");
    if (replacement !== snapshot.source.textInRange(line.contentRange)) edits.push(Object.freeze({range:line.contentRange,newText:replacement}));
  }
  let text = snapshot.source.text;
  for (const edit of edits.toReversed()) text = text.slice(0,edit.range.start)+edit.newText+text.slice(edit.range.end);
  const proposed = checkProgram(new SourceDocument(snapshot.source.id,text),{targetProfile:snapshot.targetProfile});
  if (proposed.kind === "error") return blocked("result-invalid");
  const before = original.encodedProgram.programBytes, after = proposed.encodedProgram.programBytes;
  if (before.length !== after.length || before.some((byte,index) => byte !== after[index])) return blocked("bytes-changed");
  return Object.freeze({snapshot:snapshot.identity,value:Object.freeze({kind:"formatted",guarantee:"identical-basic-bytes",edits:Object.freeze(edits),resultText:text})});
}
