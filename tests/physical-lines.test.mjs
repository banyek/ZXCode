import assert from "node:assert/strict";
import test from "node:test";
import { DiagnosticCodes, scanPhysicalLines, SourceDocument } from "@zxcode/core";

function scan(text) {
  return scanPhysicalLines(new SourceDocument("test.bas@1", text));
}

test("physical order and exact UTF-16 source spelling survive header scanning", () => {
  const text = ' 30\tPRINT "árvíz 😀"  \r\n0010 REM PRINT : " raw\r20 STOP\n';
  const result = scan(text);
  assert.equal(result.source.text, text);
  assert.deepEqual(result.syntax.lines.map((line) => line.kind), ["numbered", "numbered", "numbered", "blank"]);
  assert.deepEqual(result.syntax.lines.filter((line) => line.kind === "numbered").map((line) => line.lineNumber), [30, 10, 20]);
  assert.deepEqual(result.diagnostics, []);
  const [first, second, third] = result.syntax.lines;
  assert.equal(result.source.textInRange(first.numberRange), "30");
  assert.equal(result.source.textInRange(first.bodyRange), 'PRINT "árvíz 😀"  ');
  assert.equal(result.source.textInRange(second.numberRange), "0010");
  assert.equal(result.source.textInRange(second.bodyRange), 'REM PRINT : " raw');
  assert.deepEqual([first, second, third].map((line) => result.source.textInRange(line.lineEndingRange)), ["\r\n", "\r", "\n"]);
  assert.equal(result.syntax.lines.map((line) => result.source.textInRange(line.range)).join(""), text);
  assert.throws(() => { first.lineNumber = 1; }, TypeError);
  assert.throws(() => { result.syntax.lines.length = 0; }, TypeError);
});

test("range endpoints, legal boundaries, leading zeros and tab separators", () => {
  const result = scan("\t0001\tCLS\n9999 STOP");
  assert.deepEqual(result.diagnostics, []);
  assert.equal(result.syntax.lines[0].lineNumber, 1);
  assert.equal(result.syntax.lines[1].lineNumber, 9999);
  assert.deepEqual(result.source.positionAt(result.syntax.lines[1].numberRange.start), { line: 1, column: 0 });
  assert.equal(result.syntax.lines[1].range.end, result.source.text.length);
  assert.equal(result.syntax.lines[1].lineEndingRange.start, result.source.text.length);
});

test("duplicates use numeric identity and retain the first occurrence as evidence", () => {
  const result = scan("0010 STOP\n10 CLS\n10 PRINT");
  assert.equal(result.diagnostics.length, 2);
  for (const diagnostic of result.diagnostics) {
    assert.equal(diagnostic.code, DiagnosticCodes.duplicateLineNumber);
    assert.equal(diagnostic.related[0].range, result.syntax.lines[0].numberRange);
    assert.equal(result.source.textInRange(diagnostic.related[0].range), "0010");
  }
  assert.equal(result.syntax.lines.length, 3);
});

test("invalid or missing headers recover without manufacturing line numbers", () => {
  const malformed = ["PRINT 1", "0 STOP", "10000 STOP", "-1 STOP", "1.5 STOP", "1E2 STOP", "10PRINT 1", "١٠ STOP", "10\u00a0PRINT 1", "9".repeat(1000) + " STOP"];
  for (const line of malformed) {
    const result = scan(line + "\n20 STOP");
    assert.equal(result.syntax.lines[0].kind, "invalid", line);
    assert.equal("lineNumber" in result.syntax.lines[0], false, line);
    assert.equal(result.syntax.lines[1].lineNumber, 20, line);
    assert.equal(result.diagnostics.length, 1, line);
    assert.equal(result.diagnostics[0].severity, "error");
    assert.equal(result.diagnostics[0].category, "syntax");
  }
});

test("blank source is preserved and number-only lines are incomplete, never deletion", () => {
  assert.deepEqual(scan("").syntax.lines.map((line) => line.kind), ["blank"]);
  const result = scan(" \t\r\n10 \n10 STOP\n\t");
  assert.deepEqual(result.syntax.lines.map((line) => line.kind), ["blank", "numbered", "numbered", "blank"]);
  assert.deepEqual(result.diagnostics.map((diagnostic) => diagnostic.code), [DiagnosticCodes.missingStatement, DiagnosticCodes.duplicateLineNumber]);
  assert.equal(result.syntax.lines[1].bodyRange.start, result.syntax.lines[1].bodyRange.end);
  assert.equal(result.source.textInRange(result.syntax.lines[2].bodyRange), "STOP");
});
