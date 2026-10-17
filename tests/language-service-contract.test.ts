import { SourceDocument, parseBasic, analyzeBasic, SPECTRUM_48K_TARGET, documentDiagnostics } from "../packages/core/src/index.js";
import type { DocumentAnalysisSnapshot, DocumentAnalysisSession, LanguageServiceQueries, LanguageQueryResult, Diagnostic, LanguageTextEdit } from "../packages/core/src/index.js";

const source = new SourceDocument("incomplete.bas", "10 PRINT AT 10,\n20 GO TO\n30 FOR i=1 TO\n");
const parsed = parseBasic(source);
const snapshot: DocumentAnalysisSnapshot = {
  identity: { documentId: source.id, source, version: 1 },
  source, targetProfile: SPECTRUM_48K_TARGET, parsed, analysis: analyzeBasic(parsed)
};
declare const queries: LanguageServiceQueries;
declare const session: DocumentAnalysisSession;
const diagnostics: LanguageQueryResult<readonly Diagnostic[]> = queries.diagnostics(snapshot);
void diagnostics.snapshot.source;
void diagnostics.value[0]?.range.sourceId;
void queries.completions(snapshot, source.text.length).value.context.expectedType;
void queries.hover(snapshot, 5).value?.documentation.summary;
void queries.definitions(snapshot, 20).value[0]?.start;
void queries.references(snapshot, 20, { includeDeclaration: true }).snapshot.version;
void queries.symbols(snapshot).value[0]?.selectionRange;
void queries.signatureHelp(snapshot, 9).value?.activeParameter;
void session.update({source: new SourceDocument(source.id, "10 PRINT 1"), version: 2}).analysis;
// @ts-expect-error A source string is not a coherent analysis snapshot.
queries.diagnostics(source.text);
// @ts-expect-error Editor positions are not the core UTF-16 offset contract.
queries.hover(snapshot, {line: 0, character: 2});
// @ts-expect-error Edits require checked core ranges, not editor protocol ranges.
const badEdit: LanguageTextEdit = {range: {start: {line: 0, character: 0}, end: {line: 0, character: 1}}, newText: "PRINT"};
void badEdit;

const diagnosticQuery: LanguageServiceQueries["diagnostics"] = documentDiagnostics;
void diagnosticQuery;
