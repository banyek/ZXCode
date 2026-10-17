import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { analyzeBasic, checkProgram, parseBasic, SourceDocument } from "@zxcode/core";
const parsed = (text) => parseBasic(new SourceDocument("fn", text));
const checked = (text) => checkProgram(new SourceDocument("fn", text));
test("DEF FN hidden parameter slots and FN calls match independent program images", () => {
  const fixture = JSON.parse(readFileSync(new URL('./fixtures/functions.json', import.meta.url), 'utf8'));
  for (const entry of fixture.cases) {
    const result = checked(entry.source);
    assert.equal(result.kind, 'success', entry.source);
    assert.equal(Buffer.from(result.encodedProgram.programBytes).toString('hex'), entry.programHex, entry.source);
  }
});
test("function syntax and result typing match original-ROM observations", () => {
  const fixture = JSON.parse(readFileSync(new URL('./fixtures/functions-rom.json', import.meta.url), 'utf8'));
  for (const entry of fixture.cases) assert.equal(checked(entry.source).kind, entry.statements === undefined ? 'error' : 'success', entry.source);
  const result = checked('10 DEF FN f()=RND');
  assert.equal(result.kind, 'success');
  assert.equal(Buffer.from(result.encodedProgram.programBytes.slice(4, -1)).toString('hex'), 'ce6628293da5');
});
test("forward function lookup uses first stored definition and numeric/string identities", () => {
  const input = parsed('30 DEF FN f(x,y)=x\n10 PRINT FN f(2);FN f$("a")\n20 IF a THEN DEF FN f(x)=x: DEF FN f$(x$)=x$');
  const result = analyzeBasic(input);
  assert.equal(result.kind, 'buildable');
  assert.deepEqual(result.analysis.diagnostics, []);
  const print = result.analysis.program.lines[0].statements[0];
  const definitions = result.analysis.program.lines[1].statements[0].thenStatements;
  assert.deepEqual(print.items[0].expression.definitionRange, definitions[0].nameRange);
  assert.deepEqual(print.items[2].expression.definitionRange, definitions[1].nameRange);
  assert.notEqual(print.items[0].expression.identity.key, print.items[2].expression.identity.key);
});
test("formals bind only within their own definition and arrays retain separate identity", () => {
  const result = analyzeBasic(parsed('10 DEF FN f(x)=x+FN g()+x(1)\n20 DEF FN g()=x\n30 PRINT x'));
  assert.equal(result.kind, 'buildable');
  const [f,g,p] = result.analysis.program.lines.map((line) => line.statements[0]);
  const local = f.body.left.left;
  assert.equal(local.identity.family, 'formal');
  assert.deepEqual(local.formalRange, f.parameters[0].range);
  assert.deepEqual(local.definitionRange, f.nameRange);
  assert.equal(f.body.right.base.identity.key, 'numeric-array:x');
  assert.equal(f.body.right.base.formalRange, undefined);
  assert.equal(g.body.identity.key, 'numeric:x');
  assert.equal(p.items[0].expression.identity.key, 'numeric:x');
  assert.notEqual(local.identity.key, g.body.identity.key);
});
test("duplicate formals remain authentic with first parameter binding", () => {
  const result = analyzeBasic(parsed('10 DEF FN f(x,x)=x'));
  assert.equal(result.kind, 'buildable');
  const f = result.analysis.program.lines[0].statements[0];
  assert.equal(f.parameters.length, 2);
  assert.deepEqual(f.body.formalRange, f.parameters[0].range);
});
test("resolved call arguments and definition bodies receive semantic type/count diagnostics", () => {
  for (const text of ['10 DEF FN f(x)=x: PRINT FN f()', '10 DEF FN f(x)=x: PRINT FN f("x")', '10 DEF FN f$(x$)=x$: PRINT FN f$(2)', '10 DEF FN f()="x"', '10 DEF FN f$()=1']) {
    const result = checked(text);
    assert.equal(result.kind, 'error', text);
    assert.ok(result.diagnostics.some((item) => item.severity === 'error' && item.category === 'semantic'), text);
  }
  const missing = checked('10 PRINT FN f(2)');
  assert.equal(missing.kind, 'success');
  assert.equal(missing.diagnostics[0].severity, 'warning');
  const recursive = checked('10 DEF FN f(x)=FN f(x): PRINT FN f(2)');
  assert.equal(recursive.kind, 'success');
});
test("incomplete function nodes cannot bypass validation by stripping diagnostics", () => {
  for (const body of ['DEF FN f(x,)=x', 'DEF FN f=x', 'DEF FN f(x)=', 'DEF FN ff(x)=x', 'PRINT FN f(', 'PRINT FN f(1,)', 'PRINT FN ff(1)', 'PRINT FN f(1']) {
    const input = parsed(`10 ${body}: PRINT 2`);
    assert.ok(input.diagnostics.length > 0, body);
    assert.equal(analyzeBasic(Object.freeze({ ...input, diagnostics: Object.freeze([]) })).kind, 'invalid', body);
    assert.equal(input.syntax.lines[0].statements.at(-1).kind, 'print');
  }
});
