import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { analyzeBasic, checkProgram, DiagnosticCodes, parseBasic, SourceDocument } from "@zxcode/core";

function parsed(text) { return parseBasic(new SourceDocument("control", text)); }

test("control-flow and empty-slot bytes match thirteen independent program images", () => {
  const fixture = JSON.parse(readFileSync(new URL("./fixtures/control-flow.json", import.meta.url), "utf8"));
  for (const reference of fixture.cases) {
    const result = checkProgram(new SourceDocument("reference", reference.source));
    assert.equal(result.kind, "success", reference.source);
    assert.equal(Buffer.from(result.encodedProgram.programBytes).toString("hex"), reference.programHex, reference.source);
  }
});

test("statement structure, empty tails and 127/128 limits match independent ROM syntax observations", () => {
  const fixture = JSON.parse(readFileSync(new URL("./fixtures/statements-rom.json", import.meta.url), "utf8"));
  for (const reference of fixture.cases) {
    const result = checkProgram(new SourceDocument("rom-statement", reference.source));
    if (reference.statements !== undefined) {
      assert.equal(result.kind, "success", reference.source);
      assert.equal(result.encodedProgram.lines[0].statements.length, reference.statements);
      assert.equal(Buffer.from(result.encodedProgram.programBytes.slice(4, -1)).toString("hex"), reference.encoded);
    } else assert.equal(result.kind, "error", reference.source);
  }
});

test("IF owns the complete remaining physical line, including nested conditional tails", () => {
  const source = '10 PRINT 0: IF a THEN PRINT 1: IF b THEN CLS: STOP\n20 PRINT 2';
  const input = parsed(source);
  assert.deepEqual(input.diagnostics, []);
  const line = input.syntax.lines[0];
  assert.equal(line.statements.length, 2);
  const outer = line.statements[1];
  assert.equal(outer.kind, "if");
  assert.deepEqual(outer.thenStatements.map((statement) => statement.kind), ["print", "if"]);
  assert.deepEqual(outer.thenStatements[1].thenStatements.map((statement) => statement.kind), ["cls", "stop"]);
  assert.equal(input.source.textInRange(outer.headerRange), "IF a THEN");
  assert.equal(input.source.textInRange(outer.range), "IF a THEN PRINT 1: IF b THEN CLS: STOP");
  const result = checkProgram(input.source);
  assert.equal(result.kind, "success");
  const mappings = result.encodedProgram.lines[0].statements;
  assert.deepEqual(mappings.map((mapping) => input.source.textInRange(mapping.sourceRange)), ["PRINT 0", "IF a THEN", "PRINT 1", "IF b THEN", "CLS", "STOP"]);
  assert.deepEqual(mappings.map((mapping) => result.encodedProgram.programBytes[mapping.encodedRange.offset]), [0xf5, 0xfa, 0xf5, 0xfa, 0xfb, 0xe2]);
});

test("literal jumps retain exact forward definition relations and missing-line warnings remain nonfatal", () => {
  const input = parsed('100 STOP\n10 GO TO 100\n20 GO SUB 300');
  const result = analyzeBasic(input);
  assert.equal(result.kind, "buildable");
  const [jump, call] = result.analysis.program.lines.slice(0, 2).map((line) => line.statements[0]);
  assert.equal(jump.kind, "goto");
  assert.equal(jump.target.kind, "number");
  assert.equal(jump.lineReference.lineNumber, 100);
  assert.equal(jump.lineReference.definitionRange, input.syntax.lines[0].numberRange);
  assert.equal(call.lineReference.definitionRange, undefined);
  const warning = result.analysis.diagnostics.find((diagnostic) => diagnostic.code === DiagnosticCodes.missingLineTarget);
  assert.equal(warning.severity, "warning");
  assert.equal(input.source.textInRange(warning.range), "300");
  assert.equal(checkProgram(input.source).kind, "success");
  for (const target of ['100.0', '1e2', 'BIN 01100100']) {
    const analysis = analyzeBasic(parsed(`10 GO TO ${target}\n100 STOP`));
    assert.equal(analysis.analysis.program.lines[0].statements[0].lineReference.lineNumber, 100, target);
  }
  for (const target of ['a', '50+50', '(100)', '+100', '-100', '0', '.5', '10000']) {
    const analysis = analyzeBasic(parsed(`10 GO TO ${target}`));
    assert.equal(analysis.kind, "buildable", target);
    assert.equal(analysis.analysis.program.lines[0].statements[0].lineReference, undefined, target);
    assert.deepEqual(analysis.analysis.diagnostics, [], target);
  }
});

test("numeric conditions/targets and malformed tails cannot bypass validation", () => {
  for (const body of ['GO TO "x"', 'GO SUB a$', 'IF "x" THEN STOP', 'GO TO', 'GO SUB 1,2', 'GO', 'IF', 'IF 1 PRINT 2', 'IF 1 THEN 100', 'IF 1 THEN WHILE 1', 'IF 1 THEN PRINT (1']) {
    const input = parsed(`10 ${body}\n20 CLS`);
    assert.equal(input.syntax.lines[1].statements[0].kind, "cls", body);
    assert.equal(analyzeBasic({ ...input, diagnostics: [] }).kind, "invalid", body);
  }
  const input = parsed('10 IF 1 THEN CLS 1: STOP\n20 CLS');
  assert.equal(input.syntax.lines[0].statements[0].thenStatements[1].kind, "stop");
  const incomplete = parsed('10 IF 1 PRINT 2: STOP\n20 CLS');
  assert.equal(incomplete.syntax.lines[0].statements[0].complete, false);
  assert.equal(incomplete.syntax.lines[0].statements[0].thenStatements[0].kind, "stop");
  for (const body of ['GOTO 100', 'GOSUB 100', 'IF 1 THEN STOP ELSE CLS']) assert.equal(checkProgram(parsed(`10 ${body}`).source).kind, "error");
});

test("REM after a real THEN retains its raw tail while names in LET do not trigger that mode", () => {
  const input = parsed('10 IF a THEN REM PRINT : "unfinished');
  const tokens = input.syntax.lines[0].tokens;
  assert.equal(tokens.find((token) => token.kind === "raw-tail").text, ' PRINT : "unfinished');
  assert.ok(!input.diagnostics.some((diagnostic) => diagnostic.code === DiagnosticCodes.unterminatedString));
  const assignment = parsed('10 LET some THEN REM name=1');
  assert.deepEqual(assignment.diagnostics, []);
  assert.equal(assignment.syntax.lines[0].statements[0].target.identity.canonicalName, "somethenremname");
});
