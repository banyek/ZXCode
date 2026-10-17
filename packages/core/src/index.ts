export { SourceDocument, SourceRange } from "./source/document.js";
export type { SourcePosition } from "./source/document.js";
export { createDiagnostic, DiagnosticCodes } from "./source/diagnostic.js";
export type { Diagnostic, DiagnosticCategory, DiagnosticRelatedInformation, DiagnosticSeverity } from "./source/diagnostic.js";
export type { ParsedDocument } from "./syntax/document.js";
export type { AnalyzedProgram, BuildableProgram } from "./semantic/program.js";
export type { BasicProgramEncoder, EncodedLineMapping, EncodedProgram, EncodedRange, EncodedStatementMapping } from "./encoding/program.js";
export type { TapArtifact } from "./tap/artifact.js";
export { writeBasicTap, writeTapBlock } from "./tap/writer.js";
export type { BasicTapMetadata } from "./tap/writer.js";
export { convertNumericLiteral } from "./semantic/numeric.js";
export type { NumericLiteralResult, NumericLiteralValue } from "./semantic/numeric.js";
export { encodeNumericLiteral } from "./encoding/numeric.js";
export { scanPhysicalLines } from "./syntax/physical-lines.js";
export type { BlankPhysicalLine, InvalidPhysicalLine, NumberedPhysicalLine, PhysicalLine, PhysicalLineBase, PhysicalProgram } from "./syntax/physical-lines.js";
export { lexBody } from "./syntax/lexer.js";
export type { BodyToken, LexedBody, PlainToken, StringToken } from "./syntax/lexer.js";
export { parseBasic } from "./syntax/parser.js";
export type { BasicSyntaxLine, BasicSyntaxProgram, LiteralExpression, NumberedSyntaxLine, PrintItem, Statement } from "./syntax/parser.js";
export { analyzeBasic } from "./semantic/program.js";
export type { BasicAnalysisResult, BasicExpression, BasicLine, BasicPrintItem, BasicProgram, BasicStatement } from "./semantic/program.js";
export { encodeBasicProgram, EncodingError, M1_BASIC_BYTE_LIMIT } from "./encoding/basic.js";
export { buildTap, checkProgram } from "./build.js";
export type { BuiltTap, CheckedProgram, PipelineFailure, TapBuildOptions } from "./build.js";
export { ROM_TOKENS, romTokenByByte, romTokenBySpelling } from "./source/rom-tokens.js";
export type { RomToken, RomTokenCategory } from "./source/rom-tokens.js";
export { parseExpression } from "./syntax/expression.js";
export type { Expression } from "./syntax/expression.js";
export { identifyVariable } from "./source/variable-identity.js";
export type { VariableCategory, VariableIdentity, VariableIdentityResult } from "./source/variable-identity.js";
export { analyzeExpression, BUILTIN_SIGNATURES } from "./semantic/expression.js";
export type { BuiltinSignature, ExpectedExpressionType, ExpressionAnalysis, ExpressionType, TypedExpression } from "./semantic/expression.js";
export { SIMPLE_COMMANDS } from "./source/simple-commands.js";
export type { ColourControl, SimpleCommandDefinition, SimpleCommandShape, SimpleCommandStatement } from "./source/simple-commands.js";
export type { ScalarAssignmentTarget } from "./source/assignment-target.js";
export type { AssignmentTarget, LetStatement } from "./syntax/assignment.js";
export type { BasicLetStatement } from "./semantic/assignment.js";
export type { IfStatement, JumpStatement } from "./syntax/parser.js";
export type { BasicIfStatement, BasicJumpStatement, StaticLineReference } from "./semantic/program.js";
export type { ForStatement, NextStatement } from "./syntax/loops.js";
export type { BasicForStatement, BasicNextStatement } from "./semantic/loops.js";
export type { StringPart } from "./syntax/lexer.js";
export type { PrintStatement } from "./syntax/parser.js";
export type { BasicPrintStatement } from "./semantic/program.js";
export type { InputItem, InputStatement } from "./syntax/input.js";
export type { BasicInputItem, BasicInputStatement } from "./semantic/input.js";
export type { AccessGroup, AccessSelector } from "./source/access.js";
export type { AssignableTarget, IndexedAssignmentTarget } from "./source/assignment-target.js";
export type { BasicAssignableTarget } from "./semantic/targets.js";
export type { DimStatement } from "./syntax/dim.js";
export type { BasicDimStatement } from "./semantic/dim.js";

export type { DataStatement, ReadStatement } from "./syntax/data.js";
export type { BasicDataStatement, BasicReadStatement } from "./semantic/data.js";

export type { DefFnStatement } from "./syntax/functions.js";
export type { BasicDefFnStatement } from "./semantic/functions.js";

export type { RemStatement } from "./source/rem.js";
export type { BasicRemStatement } from "./semantic/rem.js";

export type { ListingStatement, CassetteStatement, CassetteForm } from "./source/storage-statements.js";

export { commandAvailability, SPECTRUM_48K_TARGET } from "./source/target-profile.js";
export type { CommandAvailability, RuntimeCapability, TargetProfile } from "./source/target-profile.js";
export type { BasicAnalysisOptions } from "./semantic/program.js";

export { SPECTRUM_CHARACTERS, spectrumCharacter, spectrumLiteralByte } from "./source/characters.js";
export type { SpectrumCharacter, SpectrumCharacterCategory, SpectrumExportIdentity } from "./source/characters.js";

export type { SpectrumTextAtom, SpectrumTextIssue, SpectrumTextDecodeIssue } from "./source/spectrum-text.js";
export { analyzeSpectrumText } from "./semantic/spectrum-text.js";
export type { SpectrumTextValue, SpectrumTextAnalysis } from "./semantic/spectrum-text.js";
export { encodeSpectrumText } from "./encoding/spectrum-text.js";
export { decodeSpectrumText } from "./decoding/spectrum-text.js";
export type { DecodedSpectrumText } from "./decoding/spectrum-text.js";

export { SPECTRUM_GRAPHIC_NOTATIONS, spectrumGraphicNotation, parseSpectrumGraphicNotation } from "./source/graphics-notation.js";
export type { SpectrumGraphicIdentity, SpectrumGraphicNotation } from "./source/graphics-notation.js";

export type { SourceTextContext, SourceTextPart } from "./source/spectrum-text.js";
export { formatSpectrumTextContent } from "./encoding/source-text.js";
export type { FormattedSpectrumText } from "./encoding/source-text.js";

export { MAX_TAP_PAYLOAD_LENGTH } from "./tap/format.js";
export { readTapBlocks, readBasicTap } from "./tap/reader.js";
export type { TapReadIssue, TapReadFailure, TapBlock, ReadTapBlocks, ReadBasicTap } from "./tap/reader.js";

export { decodeBasicProgram } from "./decoding/basic.js";
export type { BasicDecodeIssue, DecodedBasicSegment, DecodedBasicLine, DecodedBasicProgram } from "./decoding/basic.js";
export { exportBasicSource, inspectBasicTap } from "./import.js";
export type { BasicSourceExport, BasicTapImport } from "./import.js";

export type { LanguageDocumentInput, DocumentSnapshotIdentity, DocumentAnalysisSnapshot, DocumentSessionOptions, DocumentAnalysisSession, LanguageQueryResult, DocumentationLink, LanguageDocumentation, LanguageTextEdit, CompletionContext, LanguageCompletionItem, LanguageCompletionList, LanguageHover, LanguageSymbolKind, LanguageSymbol, LanguageSignatureParameter, LanguageSignature, LanguageSignatureHelp, LanguageReferenceOptions, LanguageServiceQueries } from "./service/contract.js";
export { createDocumentSession } from "./service/session.js";
