import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { analyzeBasic, checkProgram, parseBasic, SourceDocument } from "@zxcode/core";

const parsed = (body) => parseBasic(new SourceDocument("data", `10 ${body}`));
test("DATA/READ/RESTORE bytes match independent program images", () => {
  const fixture = JSON.parse(readFileSync(new URL("./fixtures/data.json", import.meta.url), "utf8"));
  for (const reference of fixture.cases) {
    const result = checkProgram(new SourceDocument("reference", reference.source));
    assert.equal(result.kind, "success", reference.source);
    assert.equal(Buffer.from(result.encodedProgram.programBytes).toString("hex"), reference.programHex, reference.source);
  }
});
test("DATA/READ/RESTORE syntax matches original-ROM observations", () => {
  const fixture = JSON.parse(readFileSync(new URL("./fixtures/data-rom.json", import.meta.url), "utf8"));
  for (const reference of fixture.cases) {
    const result = checkProgram(new SourceDocument("rom-data", reference.source));
    assert.equal(result.kind, reference.statements === undefined ? "error" : "success", reference.source);
    if (result.kind === "success") assert.equal(Buffer.from(result.encodedProgram.programBytes.slice(4, -1)).toString("hex"), reference.encoded, reference.source);
  }
});
test("DATA retains dynamic expressions, literal contents and comma locations", () => {
  const input = parsed('DATA a+2,RND,"a,b:c","a""b": READ a,b$');
  assert.deepEqual(input.diagnostics, []);
  const node = input.syntax.lines[0].statements[0];
  assert.equal(node.kind, "data");
  assert.deepEqual(node.items.map((item) => item.kind), ['binary-expression', 'builtin-value', 'string-literal', 'string-literal']);
  assert.deepEqual(node.commaRanges.map((range) => input.source.textInRange(range)), [',', ',', ',']);
  assert.equal(node.items[2].value, 'a,b:c');
  assert.equal(node.items[3].value, 'a"b');
  assert.ok(Object.isFrozen(node.items));
  const checked = analyzeBasic(input);
  assert.equal(checked.kind, 'buildable');
  assert.equal(checked.analysis.program.lines[0].statements[0].items[1].kind, 'builtin-value');
});
test("READ shares indexed target validation and runtime data availability stays dynamic", () => {
  for (const body of ['READ a,b$', 'READ a(1,2),b$(1 TO 3)', 'READ a$(1)(2)', 'DATA "x": READ a', 'RESTORE 15', 'RESTORE a+2']) {
    const result = checkProgram(parsed(body).source);
    assert.equal(result.kind, 'success', body);
    assert.deepEqual(result.diagnostics, [], body);
  }
  for (const body of ['READ a("x")', 'READ a$("x" TO 2)', 'READ a(1)(2)', 'DATA a+"x"', 'RESTORE "x"']) assert.equal(checkProgram(parsed(body).source).kind, 'error', body);
});
test("malformed DATA/READ remain unbuildable after parser diagnostics are removed", () => {
  for (const body of ['DATA', 'DATA ,a', 'DATA a,', 'DATA a b$', 'DATA (a', 'DATA a+','READ', 'READ a,', 'READ a+b', 'READ a(1,', 'READ a;b']) {
    const input = parsed(`${body}: PRINT 2`);
    assert.ok(input.diagnostics.length > 0, body);
    const stripped = Object.freeze({ ...input, diagnostics: Object.freeze([]) });
    assert.equal(analyzeBasic(stripped).kind, 'invalid', body);
    assert.equal(input.syntax.lines[0].statements.at(-1).kind, 'print');
  }
});
