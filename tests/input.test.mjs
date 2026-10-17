import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { analyzeBasic, checkProgram, DiagnosticCodes, parseBasic, SourceDocument } from "@zxcode/core";

function parsed(body) { return parseBasic(new SourceDocument("input-items", `10 ${body}`)); }

test("INPUT target/display/group bytes match twenty-three independent program images", () => {
  const fixture = JSON.parse(readFileSync(new URL("./fixtures/input.json", import.meta.url), "utf8"));
  for (const reference of fixture.cases) {
    const result = checkProgram(new SourceDocument("reference", reference.source));
    assert.equal(result.kind, "success", reference.source);
    assert.equal(Buffer.from(result.encodedProgram.programBytes).toString("hex"), reference.programHex, reference.source);
  }
});

test("INPUT grammar and LINE types match thirty-five original-ROM syntax observations", () => {
  const fixture = JSON.parse(readFileSync(new URL("./fixtures/input-rom.json", import.meta.url), "utf8"));
  for (const reference of fixture.cases) {
    const result = checkProgram(new SourceDocument("rom-input", reference.source));
    if (reference.statements !== undefined) {
      assert.equal(result.kind, "success", reference.source);
      assert.equal(Buffer.from(result.encodedProgram.programBytes.slice(4, -1)).toString("hex"), reference.encoded, reference.source);
    } else assert.equal(result.kind, "error", reference.source);
  }
});

test("read targets, display expressions and parenthesized PRINT groups have separate semantic roles", () => {
  const input = parsed('INPUT "prompt";a;(b;c$);LINE d$;e');
  assert.deepEqual(input.diagnostics, []);
  const analysis = analyzeBasic(input);
  assert.equal(analysis.kind, "buildable");
  const items = analysis.analysis.program.lines[0].statements[0].items;
  assert.deepEqual(items.map((item) => item.kind), ['input-display', 'input-separator', 'input-target', 'input-separator', 'input-group', 'input-separator', 'input-target', 'input-separator', 'input-target']);
  assert.equal(items[2].target.identity.key, "numeric:a");
  assert.equal(items[4].items[0].kind, "print-expression");
  assert.equal(items[4].items[0].expression.identity.key, "numeric:b");
  assert.equal(items[4].items[2].expression.identity.key, "string:c$");
  assert.equal(items[6].lineMode, true);
  assert.equal(items[8].lineMode, false);
  assert.equal(input.source.textInRange(items[6].target.range), "d$");
  assert.equal(input.source.textInRange(items[6].range), "LINE d$");
  for (const body of ['INPUT SIN a', 'INPUT RND', 'INPUT +a']) assert.equal(parsed(body).syntax.lines[0].statements[0].items[0].kind, "input-display");
  const spaced = parsed('INPUT some SIN name').syntax.lines[0].statements[0].items[0];
  assert.equal(spaced.target.identity.canonicalName, "somesinname");
});

test("LINE and display formatting use their own expected-type contexts", () => {
  for (const body of ['INPUT LINE a', 'INPUT AT a$,1;b', 'INPUT TAB a$;b', 'INPUT INK a$;b', 'INPUT #a$;b']) {
    const analysis = analyzeBasic(parsed(body));
    assert.equal(analysis.kind, "invalid");
    assert.ok(analysis.analysis.diagnostics.some((diagnostic) => diagnostic.code === DiagnosticCodes.typeMismatch), body);
  }
  assert.equal(checkProgram(parsed('INPUT LINE a$;b').source).kind, "success");
  assert.equal(checkProgram(parsed('INPUT (AT 1,2;"x";TAB 3;a$);b').source).kind, "success");
  assert.equal(checkProgram(parsed('INPUT ()').source).kind, "success");
  assert.equal(checkProgram(parsed("INPUT ;,'").source).kind, "success");
  assert.equal(checkProgram(parsed('INPUT').source).kind, "error");
});

test("invalid targets and incomplete groups recover through statements and survive diagnostic stripping", () => {
  for (const body of ['INPUT', 'INPUT a+1', 'INPUT a=1', 'INPUT LINE', 'INPUT LINE (a$)', 'INPUT "x"a', 'INPUT (a;b$', 'INPUT (a)b', 'INPUT ab$', 'INPUT #', 'INPUT AT 1 2']) {
    const input = parseBasic(new SourceDocument("bad-input", `10 ${body}: STOP\n20 CLS`));
    assert.equal(input.syntax.lines[0].statements[1].kind, "stop", body);
    assert.equal(input.syntax.lines[1].statements[0].kind, "cls");
    assert.equal(analyzeBasic({ ...input, diagnostics: [] }).kind, "invalid", body);
  }
  const unfinished = parsed('INPUT ("x";a');
  const diagnostic = unfinished.diagnostics.find((item) => item.message.includes("after INPUT display group"));
  assert.equal(diagnostic.range.start, unfinished.source.text.length);
  assert.equal(diagnostic.range.end, unfinished.source.text.length);
  for (const body of ['INPUT a(1)', 'INPUT LINE a$(1 TO 2)']) {
    const input = parsed(body);
    assert.equal(input.syntax.lines[0].statements[0].items[0].target.kind, "indexed-target");
    assert.deepEqual(input.diagnostics, []);
    assert.equal(analyzeBasic(input).kind, "buildable");
  }
});
