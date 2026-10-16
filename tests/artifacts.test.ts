import type {
  AnalyzedProgram,
  BasicProgramEncoder,
  BuildableProgram,
  EncodedProgram,
  ParsedDocument,
  TapArtifact
} from "../packages/core/src/index.js";
import { encodeBasicProgram, encodeNumericLiteral } from "../packages/core/src/index.js";

interface Model { readonly lines: readonly unknown[] }

declare const parsed: ParsedDocument<Model>;
declare const analyzed: AnalyzedProgram<Model>;
declare const buildable: BuildableProgram<Model>;
declare const encode: BasicProgramEncoder<Model>;

const encoded: EncodedProgram = encode(buildable);
void encoded.lines[0]?.statements[0]?.encodedRange?.offset;
void encoded.lines[0]?.sourceRange.sourceId;

// @ts-expect-error Raw source text is not a validated program.
encode("10 PRINT \"HELLO WORLD\"");
// @ts-expect-error Recoverable parser output has not been validated.
encode(parsed);
// @ts-expect-error Analysis alone cannot attest buildability.
encode(analyzed);
// @ts-expect-error An object copy of analysis cannot manufacture the private brand.
const unchecked: BuildableProgram<Model> = { ...analyzed };
void unchecked;

declare const tap: TapArtifact;
// @ts-expect-error A TAP artifact is not a BASIC program image/source map.
const wrongImage: EncodedProgram = tap;
// @ts-expect-error A BASIC image is not already a TAP container.
const wrongContainer: TapArtifact = encoded;
void wrongImage;
void wrongContainer;

// @ts-expect-error Numeric encoder accepts converted semantic values, not token text.
encodeNumericLiteral("1.25");
// @ts-expect-error Raw storage has not passed semantic conversion.
encodeNumericLiteral({ lexeme: "1", storage: [0, 0, 1, 0, 0] });
// @ts-expect-error The real program encoder also rejects unvalidated source.
encodeBasicProgram("10 STOP");
