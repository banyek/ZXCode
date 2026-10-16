import assert from "node:assert/strict";
import test from "node:test";
import { createDiagnostic, DiagnosticCodes, SourceDocument, SourceRange } from "@zxcode/core";

test("decoded UTF-8 positions retain exact UTF-16 source coordinates", () => {
  const text = Buffer.from("10 PRINT \"árvíz 😀\"\r\n20 STOP\n", "utf8").toString("utf8");
  const source = new SourceDocument("hello.bas@1", text);
  assert.equal(source.text, text);
  assert.equal(source.lineCount, 3);
  assert.deepEqual(source.positionAt(text.indexOf("20")), { line: 1, column: 0 });
  assert.equal(source.positionAt(text.indexOf("😀") + 2).column, 18);
  for (let offset = 0; offset <= text.length; offset++) {
    assert.equal(source.offsetAt(source.positionAt(offset)), offset);
  }
});

test("empty, trailing-newline, mixed line endings and EOF positions", () => {
  for (const text of ["", "\n", "a\rb\r\nc\n", "a", "😀"]) {
    const source = new SourceDocument("test", text);
    for (let offset = 0; offset <= text.length; offset++) {
      assert.equal(source.offsetAt(source.positionAt(offset)), offset);
    }
    assert.equal(source.range(text.length).start, text.length);
  }
  assert.equal(new SourceDocument("test", "a\rb\r\nc\n").lineCount, 4);
});

test("ranges are checked, immutable, half-open and snapshot-specific", () => {
  const source = new SourceDocument("hello@1", "árvíz 😀\n");
  const range = source.range(6, 8);
  assert.equal(source.textInRange(range), "😀");
  assert.deepEqual(JSON.parse(JSON.stringify(range)), { sourceId: "hello@1", start: 6, end: 8 });
  assert.equal(source.textInRange(source.range(0, 0)), "");
  assert.throws(() => { range.end = 100; }, TypeError);
  assert.throws(() => { source.text = "changed"; }, TypeError);
  assert.throws(() => new SourceDocument("hello@2", source.text).textInRange(range), TypeError);
  for (const [start, end] of [[-1, 0], [0, 100], [3, 2], [0.5, 2], [NaN, 2], [0, Infinity]]) {
    assert.throws(() => new SourceRange(source, start, end), RangeError);
  }
  assert.throws(() => new SourceDocument("", ""), TypeError);
  assert.throws(() => source.positionAt(-1), RangeError);
  assert.throws(() => source.positionAt(100), RangeError);
  for (const position of [{ line: -1, column: 0 }, { line: 2, column: 0 }, { line: 0, column: 100 }, { line: 0, column: -1 }, { line: 0.5, column: 0 }]) {
    assert.throws(() => source.offsetAt(position), RangeError);
  }
});

test("diagnostics preserve stable code, severity, category, ranges and related evidence", () => {
  const source = new SourceDocument("test", "10 STOP\n10 STOP");
  const related = [{ message: "First definition", range: source.range(0, 2) }];
  const diagnostic = createDiagnostic({
    code: DiagnosticCodes.duplicateLineNumber,
    severity: "error",
    category: "syntax",
    message: "Duplicate line number",
    range: source.range(8, 10),
    related
  });
  related.length = 0;
  assert.equal(diagnostic.code, "ZX1003");
  assert.equal(diagnostic.related.length, 1);
  assert.equal(JSON.parse(JSON.stringify(diagnostic)).range.start, 8);
  assert.throws(() => { diagnostic.severity = "hint"; }, TypeError);
  assert.throws(() => { diagnostic.related[0].message = "changed"; }, TypeError);
  assert.throws(() => createDiagnostic({ ...diagnostic, code: "Duplicate line number" }), TypeError);
  assert.throws(() => createDiagnostic({ ...diagnostic, severity: "fatal" }), TypeError);
  assert.throws(() => createDiagnostic({ ...diagnostic, category: "unknown" }), TypeError);
  assert.throws(() => createDiagnostic({ ...diagnostic, range: { sourceId: "test", start: -1, end: 1 } }), TypeError);
  const warning = createDiagnostic({ ...diagnostic, severity: "warning", category: "semantic", capability: "interface1" });
  assert.equal(warning.severity, "warning");
  assert.equal(warning.capability, "interface1");
});
