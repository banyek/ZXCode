import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { analyzeBasic, checkProgram, DiagnosticCodes, parseBasic, SourceDocument } from "@zxcode/core";

function parsed(body) { return parseBasic(new SourceDocument("assignment", `10 ${body}`)); }

test("scalar numeric/string LET images match seventeen independent complete program fixtures", () => {
  const fixture = JSON.parse(readFileSync(new URL("./fixtures/assignment.json", import.meta.url), "utf8"));
  for (const reference of fixture.cases) {
    const source = new SourceDocument("reference", reference.source);
    const input = parseBasic(source);
    assert.deepEqual(input.diagnostics, [], reference.source);
    assert.equal(input.syntax.lines[0].statements[0].kind, "let");
    const result = checkProgram(source);
    assert.equal(result.kind, "success", reference.source);
    assert.equal(Buffer.from(result.encodedProgram.programBytes).toString("hex"), reference.programHex, reference.source);
  }
});

test("assignment targets retain original spelling and canonical typed identity", () => {
  for (const [target, canonical, type] of [["Some SIN Name", "somesinname", "numeric"], ["A $", "a$", "string"], ["A\t1e2", "a1e2", "numeric"], ["RND", "rnd", "numeric"]]) {
    const input = parsed(`LET ${target}=${type === "string" ? '"x"' : "1"}`);
    assert.deepEqual(input.diagnostics, []);
    const statement = input.syntax.lines[0].statements[0];
    assert.equal(statement.target.kind, "scalar-target");
    assert.equal(statement.target.identity.sourceName, target);
    assert.equal(statement.target.identity.canonicalName, canonical);
    assert.equal(input.source.textInRange(statement.target.range), target);
    assert.equal(analyzeBasic(input).kind, "buildable");
  }
});

test("LET validates its result context and keeps comparisons on the right-hand side", () => {
  for (const body of ['LET a="x"', 'LET a$=1', 'LET a$=1<2', 'LET a="a" AND 1', 'LET a=STR$ 1']) {
    const result = analyzeBasic(parsed(body));
    assert.equal(result.kind, "invalid", body);
    const diagnostic = result.analysis.diagnostics.find((item) => item.code === DiagnosticCodes.typeMismatch);
    assert.ok(diagnostic, body);
    assert.equal(diagnostic.category, "semantic");
  }
  const valid = parsed('LET a=b=1');
  assert.equal(valid.syntax.lines[0].statements[0].expression.operator, "=");
  assert.equal(analyzeBasic(valid).kind, "buildable");
});

test("nonassignable expressions and missing delimiters recover without accepting implicit LET", () => {
  for (const body of ['LET 1=2', 'LET a+1=2', 'LET (a)=2', 'LET SIN(a)=2', 'LET a', 'LET =1', 'LET a=', 'LET a=1+', 'LET a=1 2', 'LET ab$="x"']) {
    const input = parseBasic(new SourceDocument("bad-assignment", `10 ${body}: STOP\n20 CLS`));
    assert.ok(input.diagnostics.length > 0, body);
    assert.equal(input.syntax.lines[0].statements[1].kind, "stop");
    assert.equal(input.syntax.lines[1].statements[0].kind, "cls");
    assert.equal(analyzeBasic({ ...input, diagnostics: [] }).kind, "invalid", body);
  }
  assert.equal(parsed('a=1').syntax.lines[0].statements[0].kind, "error-statement");
});

test("array/slice targets extend the same assignable target union", () => {
  for (const body of ['LET a(1)=2', 'LET a$(2 TO 3)="x"', 'LET a(1=2)=3']) {
    const input = parsed(body);
    const statement = input.syntax.lines[0].statements[0];
    assert.equal(statement.kind, "let");
    assert.equal(statement.target.kind, "indexed-target");
    assert.deepEqual(input.diagnostics, []);
    assert.equal(analyzeBasic(input).kind, "buildable");
  }
});
