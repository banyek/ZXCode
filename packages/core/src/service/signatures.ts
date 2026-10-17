import { parserCompletionContext } from "../syntax/completion-context.js";
import { languageHelp } from "../source/language-help.js";
import type { BasicStatement } from "../semantic/program.js";
import type { DocumentAnalysisSnapshot, LanguageQueryResult, LanguageSignature, LanguageSignatureHelp } from "./contract.js";
import { helpDocumentation } from "./help.js";
export function documentSignatureHelp(snapshot: DocumentAnalysisSnapshot, offset: number): LanguageQueryResult<LanguageSignatureHelp | undefined> {
  const state = parserCompletionContext(snapshot.parsed, offset);
  const argument = state.functionArgument;
  let signature: LanguageSignature | undefined;
  if (argument !== undefined && state.kind !== "string" && state.kind !== "rem") {
    if (!argument.user) {
      const help = languageHelp(argument.name);
      if (help?.parameters !== undefined) signature = Object.freeze({ label: `${help.syntax[0]} → ${help.resultType}`, parameters: Object.freeze(help.parameters.map((item) => Object.freeze({label:`${item.label}: ${item.type}`}))), documentation: helpDocumentation(help) });
    } else {
      const pending: BasicStatement[] = snapshot.analysis.analysis.program.lines.flatMap((line) => line.statements).reverse();
      while (pending.length !== 0) {
        const node = pending.pop()!;
        if (node.kind === "if") pending.push(...[...node.thenStatements].reverse());
        if (node.kind === "def-fn" && node.identity.canonicalName === argument.name) {
          const parameters = Object.freeze(node.parameters.map((item) => Object.freeze({label:`${item.identity.canonicalName}: ${item.identity.valueType}`})));
          signature = Object.freeze({label:`FN ${node.identity.canonicalName}(${node.parameters.map((item) => item.identity.canonicalName).join(",")}) → ${node.identity.valueType}`,parameters,documentation:Object.freeze({summary:`User-defined ${node.identity.valueType} function.`})});
          break;
        }
      }
    }
  }
  const value = signature === undefined ? undefined : Object.freeze({signatures:Object.freeze([signature]),activeSignature:0,activeParameter:Math.min(argument!.index, Math.max(0,signature.parameters.length-1))});
  return Object.freeze({snapshot:snapshot.identity,value});
}
