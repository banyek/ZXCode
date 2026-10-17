import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { analyzeBasic, checkProgram, DiagnosticCodes, parseBasic, SourceDocument } from "@zxcode/core";

function parsed(body) { return parseBasic(new SourceDocument("arrays", `10 ${body}`)); }

test("array/DIM/slice bytes match twenty-five independent program images", () => {
  const fixture = JSON.parse(readFileSync(new URL("./fixtures/arrays.json", import.meta.url), "utf8"));
  for (const reference of fixture.cases) {
    const result = checkProgram(new SourceDocument("reference", reference.source));
    assert.equal(result.kind, "success", reference.source);
    assert.equal(Buffer.from(result.encodedProgram.programBytes).toString("hex"), reference.programHex, reference.source);
  }
});

test("array, slice and assignability boundaries match fifty-six original-ROM observations", () => {
  const fixture = JSON.parse(readFileSync(new URL("./fixtures/arrays-rom.json", import.meta.url), "utf8"));
  for (const reference of fixture.cases) {
    const result = checkProgram(new SourceDocument("rom-arrays", reference.source));
    if (reference.statements !== undefined) {
      assert.equal(result.kind, "success", reference.source);
      assert.equal(Buffer.from(result.encodedProgram.programBytes.slice(4, -1)).toString("hex"), reference.encoded, reference.source);
    } else assert.equal(result.kind, "error", reference.source);
  }
});

test("TO/open/empty selectors remain contextual source nodes with no inserted bounds", () => {
  for (const [text, from, to, hasTo] of [['a$()', false, false, false], ['a$( TO )', false, false, true], ['a$( TO 2)', false, true, true], ['a$(2 TO )', true, false, true], ['a$(1 TO 2)', true, true, true]]) {
    const input = parsed(`PRINT ${text}`);
    assert.deepEqual(input.diagnostics, []);
    const expression = input.syntax.lines[0].statements[0].items[0].expression;
    assert.equal(expression.kind, "access-expression");
    const selector = expression.group.selectors[0];
    assert.equal(selector.kind, "slice");
    assert.equal(selector.from !== undefined, from);
    assert.equal(selector.to !== undefined, to);
    assert.equal(selector.hasTo, hasTo);
    assert.equal(input.source.textInRange(expression.range), text);
    assert.ok(Object.isFrozen(expression.group.selectors));
  }
  const item = parsed('PRINT a$(1,)').syntax.lines[0].statements[0].items[0].expression;
  assert.deepEqual(item.group.selectors.map((selector) => selector.kind), ['index', 'slice']);
  assert.equal(item.group.selectors[1].hasTo, false);
});

test("DIM and access identities distinguish numeric storage while string storage remains shared", () => {
  const input = parsed('DIM a(2,3): DIM b$(2,10): PRINT a+a(1,2);b$(1,2)');
  const result = analyzeBasic(input);
  assert.equal(result.kind, "buildable");
  const [numeric, string, print] = result.analysis.program.lines[0].statements;
  assert.equal(numeric.kind, "dim");
  assert.equal(numeric.identity.key, "numeric-array:a");
  assert.equal(numeric.dimensions.length, 2);
  assert.equal(string.identity.key, "string:b$");
  assert.equal(string.identity.category, "string-array");
  const sum = print.items[0].expression;
  assert.equal(sum.left.identity.key, "numeric:a");
  assert.equal(sum.right.base.identity.key, "numeric-array:a");
  assert.equal(print.items[2].expression.base.identity.key, string.identity.key);
  assert.equal(print.items[2].expression.type, "string");
});

test("named indexed targets reuse access typing in LET and INPUT, including repeated string slices", () => {
  for (const body of ['LET a(1,2)=3', 'LET a$(1)(2 TO 3)="x"', 'LET a$()(1)="x"', 'INPUT a(1)', 'INPUT LINE a$(1,2 TO 3)']) {
    const input = parsed(body);
    assert.deepEqual(input.diagnostics, [], body);
    const result = analyzeBasic(input);
    assert.equal(result.kind, "buildable", body);
    const statement = result.analysis.program.lines[0].statements[0];
    const target = statement.kind === "input" ? statement.items[0].target : statement.target;
    assert.equal(target.kind, "indexed-target");
    assert.ok(target.groups.every((group) => group.complete && group.closed));
  }
  for (const body of ['LET "abc"(1)="x"', 'LET (a$)(1)="x"', 'LET a(1)(2)=3', 'INPUT LINE a(1)']) assert.equal(checkProgram(parsed(body).source).kind, "error", body);
});

test("numeric subscript/bound/dimension contexts diagnose and malformed groups cannot bypass validation", () => {
  for (const body of ['PRINT a("x")', 'PRINT a$(1 TO "x")', 'DIM a("x")', 'DIM a$(1,a$)', 'LET a(1)="x"', 'LET a$(1)=2']) {
    const result = analyzeBasic(parsed(body));
    assert.equal(result.kind, "invalid", body);
    assert.ok(result.analysis.diagnostics.some((diagnostic) => diagnostic.code === DiagnosticCodes.typeMismatch), body);
  }
  for (const body of ['PRINT a(1', 'PRINT a$( TO 2', 'PRINT a$(,2)', 'PRINT a$(1,,)', 'PRINT a$(1 TO 2,3)', 'DIM a()', 'DIM a$( TO 2)', 'DIM a(1)(2)', 'DIM a(1),b(2)', 'DIM ab(1)', 'LET a$(1 TO)=', 'INPUT a(1']) {
    const input = parseBasic(new SourceDocument("bad-access", `10 ${body}: STOP\n20 CLS`));
    assert.equal(input.syntax.lines[0].statements[1].kind, "stop", body);
    assert.equal(input.syntax.lines[1].statements[0].kind, "cls");
    assert.equal(analyzeBasic({ ...input, diagnostics: [] }).kind, "invalid", body);
  }
  for (const body of ['PRINT a$(-1 TO 2)', 'PRINT a$(8 TO 7)', 'DIM a(0)', 'PRINT a(1)']) assert.equal(checkProgram(parsed(body).source).kind, "success", body);
});

test("postfix grouping follows ROM prefix/special-function binding and nesting recovers safely", () => {
  assert.equal(checkProgram(parsed('PRINT SCREEN$(1,2)(1)').source).kind, "success");
  assert.equal(checkProgram(parsed('PRINT STR$ PI(1)').source).kind, "error");
  assert.equal(checkProgram(parsed('PRINT (STR$ PI)(1)').source).kind, "success");
  const nested = 'a('.repeat(300) + '1' + ')'.repeat(300);
  const input = parseBasic(new SourceDocument("deep-access", `10 PRINT ${nested}\n20 STOP`));
  assert.ok(input.diagnostics.length > 0);
  assert.equal(input.syntax.lines[1].statements[0].kind, "stop");
  assert.equal(analyzeBasic(input).kind, "invalid");
});
