import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { analyzeBasic, encodeBasicProgram, EncodingError, M1_BASIC_BYTE_LIMIT, parseBasic, SourceDocument } from "@zxcode/core";

function analyze(text) { return analyzeBasic(parseBasic(new SourceDocument("test.bas@1", text))); }
function encode(text) {
  const result = analyze(text);
  assert.equal(result.kind, "buildable");
  return encodeBasicProgram(result.analysis);
}

test("hello bytes match the independently produced zmakebas fixture", () => {
  const source = readFileSync(new URL("./fixtures/hello.bas", import.meta.url), "utf8");
  const hex = readFileSync(new URL("./fixtures/hello-program.hex", import.meta.url), "utf8").replace(/\s/g, "");
  assert.equal(Buffer.from(encode(source).programBytes).toString("hex"), hex);
  assert.equal(Buffer.from(encode(source).programBytes).toString("hex"), hex);
});

test("tokens, literal keyword text, colon sequencing and line lengths are exact", () => {
  const image = encode('100 CLS:PRINT "STOP":STOP');
  assert.deepEqual([...image.programBytes], [0, 100, 12, 0, 0xfb, 0x3a, 0xf5, 0x22, 0x53, 0x54, 0x4f, 0x50, 0x22, 0x3a, 0xe2, 0x0d]);
  assert.deepEqual(image.lines[0].statements.map((item) => item.encodedRange), [{ offset: 4, length: 1 }, { offset: 6, length: 7 }, { offset: 14, length: 1 }]);
});

test("numeric encoding uses retained text and already converted ROM storage", () => {
  const image = encode("10 PRINT .5");
  assert.deepEqual([...image.programBytes], [0, 10, 10, 0, 0xf5, 0x2e, 0x35, 0x0e, 0x7f, 0x7f, 0xff, 0xff, 0xff, 0x0d]);
});

test("numeric line order maps back to unchanged physical source ranges", () => {
  const text = '20 STOP\n10 PRINT "HELLO WORLD"';
  const result = analyze(text);
  const image = encodeBasicProgram(result.analysis);
  assert.deepEqual(image.lines.map((line) => [line.basicLineNumber, line.encodedOffset, line.encodedLength]), [[10, 0, 19], [20, 19, 6]]);
  assert.equal(result.analysis.source.textInRange(image.lines[1].statements[0].sourceRange), "STOP");
  assert.equal(image.lines[1].statements[0].encodedRange.offset, 23);
  assert.equal(image.programBytes[23], 0xe2);
  assert.equal(image.sourceId, result.analysis.source.id);
  assert.throws(() => { image.lines.length = 0; }, TypeError);
});

test("only actual validated values reach encoding", () => {
  assert.throws(() => encodeBasicProgram("10 STOP"), TypeError);
  assert.throws(() => encodeBasicProgram(parseBasic(new SourceDocument("test", "10 STOP"))), TypeError);
  const result = analyze("10 STOP");
  assert.throws(() => encodeBasicProgram({ ...result.analysis }), TypeError);
});

test("M1 capacity bound never emits wrapped or untested oversized images", () => {
  // Header(4), PRINT(1), quotes(2), CR(1): eight bytes beyond string contents.
  assert.equal(encode('10 PRINT "' + "A".repeat(M1_BASIC_BYTE_LIMIT - 8) + '"').programBytes.length, M1_BASIC_BYTE_LIMIT);
  assert.throws(() => encode('10 PRINT "' + "A".repeat(M1_BASIC_BYTE_LIMIT - 7) + '"'), (error) => error instanceof EncodingError && error.diagnostic.category === "compatibility");
});
