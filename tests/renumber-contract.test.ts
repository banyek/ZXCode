import type { DocumentAnalysisSnapshot, RenumberOptions, RenumberResult, RenumberApplyResult, RenumberReference } from "../packages/core/src/index.js";
const options:RenumberOptions={fromLine:20,throughLine:200,start:100,step:10};
void options;
declare const result:RenumberResult;
declare const current:DocumentAnalysisSnapshot;
void result.snapshot.version;
void current.identity.source.text;
if(result.value.kind === "preview") {
  void result.value.guarantee;
  void result.value.edits[0]?.range.sourceId;
  void result.value.references[0]?.resolution;
  // @ts-expect-error A validated preview is immutable.
  result.value.resultText="changed";
} else {
  void result.value.issues[0]?.code;
  // @ts-expect-error Blocked operations expose no partial text edits.
  void result.value.edits;
}
declare const applied:RenumberApplyResult;
if(applied.kind === "success") void applied.text;
// @ts-expect-error A native editor position is not a checked core source range.
const badReference:RenumberReference={command:"GO TO",range:{start:{line:0,character:0},end:{line:0,character:2}},fromValue:10,toValue:100,resolution:"exact"};
void badReference;
