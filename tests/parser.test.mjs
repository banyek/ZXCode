import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { DiagnosticCodes, parseBasic, SourceDocument } from "@zxcode/core";

function parse(text) { return parseBasic(new SourceDocument("test.bas@1", text)); }

test("hello fixture uses the recoverable CST and dedicated PRINT/literal nodes", () => {
  const parsed = parse(readFileSync(new URL("./fixtures/hello.bas", import.meta.url), "utf8"));
  assert.deepEqual(parsed.diagnostics, []);
  const line = parsed.syntax.lines[0];
  const statement = line.statements[0];
  assert.equal(line.lineNumber, 10);
  assert.equal(statement.kind, "print");
  assert.equal(statement.items[0].expression.kind, "string-literal");
  assert.equal(statement.items[0].expression.value, "HELLO WORLD");
  assert.equal(parsed.source.textInRange(statement.range), 'PRINT "HELLO WORLD"');
  assert.equal(parsed.source.textInRange(statement.items[0].expression.range), '"HELLO WORLD"');
  assert.equal(line.tokens.map((token) => token.text).join(""), parsed.source.textInRange(line.bodyRange));
});

test("statement dispatch preserves case, PRINT separators, numeric spelling and colon sequencing", () => {
  const parsed = parse('10 cLs : pRiNt "a";.5,1E+2;: sToP');
  assert.deepEqual(parsed.diagnostics, []);
  const line = parsed.syntax.lines[0];
  assert.deepEqual(line.statements.map((statement) => statement.kind), ["cls", "print", "stop"]);
  assert.equal(line.tokens[0].text, "cLs");
  const items = line.statements[1].items;
  assert.deepEqual(items.filter((item) => item.kind === "print-separator").map((item) => item.separator), [";", ",", ";"]);
  assert.deepEqual(items.filter((item) => item.kind === "print-expression").map((item) => item.expression.lexeme ?? item.expression.value), ["a", ".5", "1E+2"]);
  assert.deepEqual(parse("10 PRINT").diagnostics, []);
});

test("quoted keyword/colon text and REM tails never become ordinary command tokens", () => {
  const parsed = parse('10 PRINT "REM : CLS STOP": REM PRINT : " unfinished');
  const line = parsed.syntax.lines[0];
  assert.equal(line.statements.length, 2);
  assert.equal(line.statements[0].items[0].expression.value, "REM : CLS STOP");
  const tail = line.tokens.find((token) => token.kind === "raw-tail");
  assert.equal(tail.text, ' PRINT : " unfinished');
  assert.equal(line.tokens.filter((token) => token.kind === "colon").length, 1);
  assert.equal(parsed.diagnostics.length, 1);
  assert.equal(parsed.diagnostics[0].code, DiagnosticCodes.unsupportedSyntax);
  assert.equal(line.statements[1].kind, "error-statement");
});

test("malformed statements recover at colons and physical boundaries", () => {
  const parsed = parse('10 CLS 1: PRINT AT 1,2: STOP\n20 PRINT "not closed : STOP\n30 CLS');
  assert.deepEqual(parsed.syntax.lines[0].statements.map((statement) => statement.kind), ["error-statement", "error-statement", "stop"]);
  assert.equal(parsed.syntax.lines[1].statements.length, 1);
  assert.equal(parsed.syntax.lines[1].statements[0].items[0].expression.closed, false);
  assert.equal(parsed.syntax.lines[2].statements[0].kind, "cls");
  assert.ok(parsed.diagnostics.some((diagnostic) => diagnostic.code === DiagnosticCodes.unterminatedString));
});

test("incomplete/unsupported source retains nodes and insertion positions rather than throwing", () => {
  for (const text of ["10", "10 PRINT 1e+", '10 PRINT "', "10 PRINT (", "10 WHILE 1", "PRINT 1\n20 STOP", '10 PRINT "a""b"']) {
    const parsed = parse(text);
    assert.ok(parsed.diagnostics.length > 0, text);
    assert.ok(parsed.syntax.lines.length > 0);
    for (const diagnostic of parsed.diagnostics) {
      assert.equal(diagnostic.range.sourceId, parsed.source.id);
      assert.ok(diagnostic.range.end <= text.length);
    }
  }
});
