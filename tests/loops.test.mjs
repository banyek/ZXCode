import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { analyzeBasic, checkProgram, DiagnosticCodes, parseBasic, SourceDocument } from "@zxcode/core";

function parsed(body) { return parseBasic(new SourceDocument("loops", `10 ${body}`)); }

test("FOR/NEXT program images match eight independent fixtures", () => {
  const fixture = JSON.parse(readFileSync(new URL("./fixtures/loops.json", import.meta.url), "utf8"));
  for (const reference of fixture.cases) {
    const result = checkProgram(new SourceDocument("reference", reference.source));
    assert.equal(result.kind, "success", reference.source);
    assert.equal(Buffer.from(result.encodedProgram.programBytes).toString("hex"), reference.programHex, reference.source);
  }
});

test("loop grammar and numeric types match fourteen original-ROM syntax observations", () => {
  const fixture = JSON.parse(readFileSync(new URL("./fixtures/loops-rom.json", import.meta.url), "utf8"));
  for (const reference of fixture.cases) {
    const result = checkProgram(new SourceDocument("rom-loops", reference.source));
    if (reference.statements !== undefined) {
      assert.equal(result.kind, "success", reference.source);
      assert.equal(result.encodedProgram.lines[0].statements.length, reference.statements);
      assert.equal(Buffer.from(result.encodedProgram.programBytes.slice(4, -1)).toString("hex"), reference.encoded);
    } else assert.equal(result.kind, "error", reference.source);
  }
});

test("control variables share scalar identity and retain source ranges and case", () => {
  const input = parsed('FOR A = 1+2 TO limit STEP -1: NEXT a');
  assert.deepEqual(input.diagnostics, []);
  const [loop, next] = input.syntax.lines[0].statements;
  assert.equal(loop.kind, "for");
  assert.equal(next.kind, "next");
  assert.equal(loop.variable.identity.category, "for-control");
  assert.equal(loop.variable.identity.key, next.variable.identity.key);
  assert.equal(loop.variable.identity.key, "numeric:a");
  assert.equal(input.source.textInRange(loop.variable.range), "A");
  assert.equal(loop.start.operator, "+");
  assert.equal(loop.limit.identity.canonicalName, "limit");
  assert.equal(loop.step.operator, "-");
  assert.equal(analyzeBasic(input).kind, "buildable");
});

test("numeric range and STEP types are checked without inventing integer/positive-step restrictions", () => {
  for (const body of ['FOR a="x" TO 2', 'FOR a=1 TO "x"', 'FOR a=1 TO 2 STEP "x"']) {
    const result = analyzeBasic(parsed(body));
    assert.equal(result.kind, "invalid");
    assert.ok(result.analysis.diagnostics.some((diagnostic) => diagnostic.code === DiagnosticCodes.typeMismatch));
  }
  for (const body of ['FOR a=.5 TO 2 STEP .25', 'FOR a=2 TO 1 STEP -1', 'FOR a=1 TO 2 STEP 0', 'NEXT a']) assert.equal(checkProgram(parsed(body).source).kind, "success", body);
  const implicit = parsed('FOR a=1 TO 2').syntax.lines[0].statements[0];
  assert.equal(implicit.step, undefined);
});

test("missing delimiters and invalid loop variables recover and remain unbuildable", () => {
  for (const body of ['FOR ab=1 TO 2', 'FOR a$=1 TO 2', 'FOR a1=1 TO 2', 'FOR 1=1 TO 2', 'FOR =1 TO 2', 'FOR a', 'FOR a=1', 'FOR a=1 2', 'FOR a=1 TO', 'FOR a=1 TO 2 STEP', 'FOR a=1 TO 2 STEP 1,2', 'NEXT', 'NEXT ab', 'NEXT a$', 'NEXT a,b', 'NEXT a(1)']) {
    const input = parseBasic(new SourceDocument("bad-loop", `10 ${body}: STOP\n20 CLS`));
    assert.ok(input.diagnostics.length > 0, body);
    assert.equal(input.syntax.lines[0].statements[1].kind, "stop");
    assert.equal(input.syntax.lines[1].statements[0].kind, "cls");
    assert.equal(analyzeBasic({ ...input, diagnostics: [] }).kind, "invalid", body);
  }
  for (const body of ['WHILE 1', 'WEND', 'FOR a IN b']) assert.equal(checkProgram(parsed(body).source).kind, "error", body);
});
