import { checkProgram } from "../build.js";
import { numericLiteralNumber } from "../semantic/numeric.js";
import type { TypedExpression } from "../semantic/expression.js";
import type { BasicStatement } from "../semantic/program.js";
import { SourceDocument } from "../source/document.js";
import { documentDiagnostics } from "../service/diagnostics.js";
import type { DocumentAnalysisSnapshot, LanguageTextEdit } from "../service/contract.js";
import type { RenumberOptions, RenumberResult, RenumberApplyResult, RenumberIssue, RenumberCommand, RenumberReference } from "./renumber-contract.js";

export function previewRenumber(snapshot: DocumentAnalysisSnapshot, options: RenumberOptions = {}): RenumberResult {
  const blocked = (issues: readonly RenumberIssue[]): RenumberResult => Object.freeze({ snapshot: snapshot.identity, value: Object.freeze({ kind: "blocked", issues: Object.freeze(issues.map(issue => Object.freeze(issue))) }) });
  const from = options.fromLine ?? 1, through = options.throughLine ?? 9999;
  const start = options.start ?? 10, step = options.step ?? 10;
  if (![from, through, start, step].every(value => Number.isSafeInteger(value) && value >= 1 && value <= 9999) || from > through) return blocked([{code:"invalid-options",message:"Use integer bounds, start and step in 1..9999, with fromLine <= throughLine."}]);
  if (snapshot.analysis.kind !== "buildable" || documentDiagnostics(snapshot).value.some(d => d.severity === "error")) return blocked([{code:"invalid-program",message:"Resolve program errors before renumbering."}]);
  const lines = snapshot.analysis.analysis.program.lines;
  let selected = 0;
  const changes = lines.map(line => Object.freeze({from:line.lineNumber,to:line.lineNumber >= from && line.lineNumber <= through ? start + selected++ * step : line.lineNumber,range:line.numberRange}));
  if (changes.some(line => line.to > 9999)) return blocked([{code:"invalid-options",message:"The numbering scheme exceeds line 9999."}]);
  if (new Set(changes.map(line => line.to)).size !== changes.length) return blocked([{code:"collision",message:"The numbering scheme produces duplicate declarations."}]);
  if (changes.some((line,index) => index > 0 && line.to <= changes[index-1]!.to)) return blocked([{code:"order-change",message:"The numbering scheme crosses an unselected stored line."}]);
  const edits: LanguageTextEdit[] = changes.filter(line => line.from !== line.to).map(line => Object.freeze({range:line.range,newText:String(line.to)}));
  const references: RenumberReference[] = [], issues: RenumberIssue[] = [];
  const reference = (command: RenumberCommand, target: TypedExpression): void => {
    let literal = target;
    while (literal.kind === "parenthesized") literal = literal.expression;
    if (literal.kind !== "number" && literal.kind !== "binary-literal") { issues.push({code:"unproven-reference",message:`${command} has a computed target that cannot be safely rewritten.`,range:target.range}); return; }
    const value = numericLiteralNumber(literal.value);
    if (!Number.isInteger(value) || value < 0 || value > 9999) { issues.push({code:"unsupported-reference",message:`${command} requires a proven integer target in 0..9999.`,range:target.range}); return; }
    const anchor = changes.find(line => line.from >= value);
    let next = value;
    const resolution = value === 0 ? "start" : anchor === undefined ? "end" : anchor.from === value ? "exact" : "following";
    if (resolution === "exact") next = anchor!.to;
    else if (resolution === "following" && changes.find(line => line.to >= value) !== anchor) next = anchor!.to;
    else if (resolution === "end" && value <= (changes.at(-1)?.to ?? 0)) next = changes.at(-1)!.to + 1;
    if (next > 9999) { issues.push({code:"end-target-captured",message:`${command}'s end-of-program bound cannot be preserved within 0..9999.`,range:target.range}); return; }
    references.push(Object.freeze({command,range:target.range,fromValue:value,toValue:next,resolution,...(anchor === undefined || value === 0 ? {} : {resolvedOldLine:anchor.from})}));
    if (next !== value) edits.push(Object.freeze({range:target.range,newText:String(next)}));
  };
  const visit = (statements: readonly BasicStatement[]): void => {
    for (const statement of statements) {
      if (statement.kind === "if") visit(statement.thenStatements);
      else if (statement.kind === "goto" || statement.kind === "gosub") reference(statement.kind === "goto" ? "GO TO" : "GO SUB",statement.target);
      else if (statement.kind === "simple-command") {
        const command = statement.definition.token.spelling;
        if ((command === "RUN" || command === "RESTORE") && statement.operands[0] !== undefined) reference(command,statement.operands[0]);
      } else if ((statement.kind === "list" || statement.kind === "llist") && statement.startLine !== undefined) reference(statement.kind === "list" ? "LIST" : "LLIST",statement.startLine);
      else if (statement.kind === "cassette" && statement.command === "SAVE" && statement.form.kind === "line") reference("SAVE LINE",statement.form.line);
    }
  };
  if (edits.length > 0) visit(lines.flatMap(line => line.statements));
  if (issues.length > 0) return blocked(issues);
  edits.sort((a,b) => a.range.start-b.range.start);
  let text = snapshot.source.text;
  for (const edit of edits.toReversed()) text = text.slice(0,edit.range.start)+edit.newText+text.slice(edit.range.end);
  if (checkProgram(new SourceDocument(snapshot.source.id,text),{targetProfile:snapshot.targetProfile}).kind === "error") return blocked([{code:"result-invalid",message:"The proposed program fails shared compatibility or binary-limit checks."}]);
  return Object.freeze({snapshot:snapshot.identity,value:Object.freeze({kind:"preview",guarantee:"literal-line-destinations",lines:Object.freeze(changes),references:Object.freeze(references),edits:Object.freeze(edits),resultText:text,notes:Object.freeze(["Preserves proven literal destinations and stored order; source/RAM inspection and runtime program modification are outside this guarantee."])})});
}

/** Hosts must also guard their live document version before atomic application. */
export function applyRenumber(preview: RenumberResult, current: DocumentAnalysisSnapshot): RenumberApplyResult {
  if (preview.snapshot !== current.identity) return Object.freeze({kind:"blocked",issues:Object.freeze([Object.freeze({code:"stale-preview",message:"The document changed; create a new preview."} as const)])});
  if (preview.value.kind === "blocked") return preview.value;
  return Object.freeze({kind:"success",text:preview.value.resultText,edits:preview.value.edits});
}
