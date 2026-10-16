import assert from "node:assert/strict";
import test from "node:test";
import { analyzeBasic, createDiagnostic, DiagnosticCodes, parseBasic, SourceDocument } from "@zxcode/core";
import { assertBuildableProgram } from "../packages/core/dist/semantic/program.js";

function parsed(text) { return parseBasic(new SourceDocument("test.bas@1", text)); }

test("semantic validation produces sorted buildable data with original ranges", () => {
  const input = parsed('30 STOP\n10 PRINT "HELLO WORLD"\n20 PRINT .5');
  const result = analyzeBasic(input);
  assert.equal(result.kind, "buildable");
  assert.equal(result.analysis.source, input.source);
  assert.deepEqual(result.analysis.program.lines.map((line) => line.lineNumber), [10, 20, 30]);
  assert.equal(result.analysis.program.lines[0].range, input.syntax.lines[1].range);
  const string = result.analysis.program.lines[0].statements[0].items[0].expression;
  assert.deepEqual(string.bytes, [...Buffer.from("HELLO WORLD", "ascii")]);
  const number = result.analysis.program.lines[1].statements[0].items[0].expression;
  assert.deepEqual(number.value.storage, [0x7f, 0x7f, 0xff, 0xff, 0xff]);
  assert.throws(() => { result.analysis.program.lines.length = 0; }, TypeError);
  assert.throws(() => { string.bytes[0] = 0; }, TypeError);
});

test("syntax, compatibility and numeric errors prevent a buildable result", () => {
  for (const text of ['10 PRINT "', "10 CLS 1", "10 PRINT 1E39", "10 PRINT 1e", "10 REM raw", "10 STOP\n10 CLS", '10 PRINT "😀"', '10 PRINT "é"', '10 PRINT "`"', '10 PRINT "\t"', "PRINT 1", "10"]) {
    const result = analyzeBasic(parsed(text));
    assert.equal(result.kind, "invalid", text);
    assert.ok(result.analysis.diagnostics.some((diagnostic) => diagnostic.severity === "error"), text);
  }
  const emoji = analyzeBasic(parsed('10 PRINT "😀"'));
  const diagnostic = emoji.analysis.diagnostics.find((item) => item.code === DiagnosticCodes.unsupportedCharacter);
  assert.equal(emoji.analysis.source.textInRange(diagnostic.range), "😀");
  const overflow = analyzeBasic(parsed("10 PRINT 1E39"));
  assert.equal(overflow.analysis.diagnostics[0].code, DiagnosticCodes.numericOverflow);
  assert.equal(overflow.analysis.diagnostics[0].category, "compatibility");
});

test("warnings, information and hints remain attached without blocking valid input", () => {
  const input = parsed("10 STOP");
  for (const severity of ["warning", "information", "hint"]) {
    const diagnostic = createDiagnostic({ code: DiagnosticCodes.missingLineTarget, severity, category: "semantic", message: "Non-fatal analysis finding", range: input.syntax.lines[0].numberRange });
    const result = analyzeBasic({ ...input, diagnostics: [diagnostic] });
    assert.equal(result.kind, "buildable");
    assert.equal(result.analysis.diagnostics[0], diagnostic);
  }
});

test("removing parser diagnostics cannot make retained error/incomplete nodes buildable", () => {
  for (const text of ["10 CLS 1", '10 PRINT "', "PRINT 1", "10", "10 STOP\n10 CLS"]) {
    const input = parsed(text);
    const result = analyzeBasic({ ...input, diagnostics: [] });
    assert.equal(result.kind, "invalid", text);
    assert.ok(result.analysis.diagnostics.some((diagnostic) => diagnostic.severity === "error"));
  }
});

test("copying a validation brand cannot promote edited data to encoder input", () => {
  const result = analyzeBasic(parsed("10 STOP"));
  assert.doesNotThrow(() => assertBuildableProgram(result.analysis));
  assert.throws(() => assertBuildableProgram({ ...result.analysis }), TypeError);
  assert.throws(() => assertBuildableProgram(parsed("10 STOP")), TypeError);
});
