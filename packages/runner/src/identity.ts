import { createHash } from "node:crypto";
import type { EncodedLineMapping, EncodedProgram, SourceDocument, SourceRange } from "@zxcode/core";
export interface RunBuildMetadata {
  readonly schemaVersion:1;
  readonly buildId:string;
  readonly source:SourceDocument;
  readonly sourceVersion:number;
  readonly sourceSha256:string;
  readonly target:"spectrum-48k";
  readonly autostartLine:number;
  readonly programSha256:string;
  readonly programByteLength:number;
  readonly tapSha256:string;
  readonly tapByteLength:number;
  readonly sourceUnits:"utf16-code-units";
  readonly encodedUnits:"basic-program-bytes";
  readonly sourceMap:readonly EncodedLineMapping[];
}
/** Internal metadata construction after the shared compiler has validated source. */
export function createRunBuildMetadata(source: SourceDocument, version: number, encoded: EncodedProgram, autostart: number, tap: Uint8Array): RunBuildMetadata {
  if (encoded.sourceId !== source.id) throw new TypeError("Encoded source map belongs to a different source.");
  const copyRange = (range: SourceRange): SourceRange => {
    if (range.sourceId !== source.id) throw new TypeError("Encoded range belongs to a different source.");
    return source.range(range.start,range.end);
  };
  const hash = (data:string | Uint8Array): string => createHash("sha256").update(data).digest("hex");
  const sourceMap = Object.freeze(encoded.lines.map((line) => Object.freeze({
    basicLineNumber:line.basicLineNumber,sourceRange:copyRange(line.sourceRange),encodedOffset:line.encodedOffset,encodedLength:line.encodedLength,
    statements:Object.freeze(line.statements.map((statement) => Object.freeze({sourceRange:copyRange(statement.sourceRange),...(statement.encodedRange === undefined ? {} : {encodedRange:Object.freeze({...statement.encodedRange})})})))
  })));
  const buildId = createHash("sha256").update(JSON.stringify({sourceId:source.id,text:source.text,version,target:"spectrum-48k",autostart})).update(tap).digest("hex");
  return Object.freeze({schemaVersion:1,buildId,source,sourceVersion:version,sourceSha256:hash(source.text),target:"spectrum-48k",autostartLine:autostart,programSha256:hash(encoded.programBytes),programByteLength:encoded.programBytes.length,tapSha256:hash(tap),tapByteLength:tap.length,sourceUnits:"utf16-code-units",encodedUnits:"basic-program-bytes",sourceMap});
}
