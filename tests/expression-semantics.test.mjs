import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { analyzeBasic, analyzeExpression, BUILTIN_SIGNATURES, checkProgram, DiagnosticCodes, encodeBasicProgram, parseBasic, parseExpression, SourceDocument } from "@zxcode/core";

function analyze(text, expected) {
  const source = new SourceDocument("typed", text);
  return analyzeExpression(parseExpression(source, source.range(0, text.length)), expected);
}
function checked(text) { return checkProgram(new SourceDocument("build", `10 PRINT ${text}`)); }

test("expression signatures and operator types agree with 114 independent ROM syntax checks", () => {
  const fixture = JSON.parse(readFileSync(new URL("./fixtures/expression-types-rom.json", import.meta.url), "utf8"));
  for (const reference of fixture.cases) {
    const result = analyze(reference.source);
    if (reference.type !== undefined) {
      assert.deepEqual(result.diagnostics, [], reference.source);
      assert.equal(result.expression.type, reference.type, reference.source);
      assert.equal(checked(reference.source).kind, "success", reference.source);
    } else {
      assert.equal(result.expression.type, "error", reference.source);
      assert.ok(result.diagnostics.some((diagnostic) => diagnostic.code === DiagnosticCodes.typeMismatch), reference.source);
      assert.equal(checked(reference.source).kind, "error", reference.source);
    }
  }
});

test("expected result types diagnose at the expression while suppressing error cascades", () => {
  assert.deepEqual(analyze('"a"+"b"', "string").diagnostics, []);
  assert.equal(analyze('"a"+"b"', "numeric").diagnostics[0].code, DiagnosticCodes.typeMismatch);
  assert.equal(analyze('1<2', "string").diagnostics[0].category, "semantic");
  const wrongArgument = analyze('SIN "x"', "string");
  assert.equal(wrongArgument.diagnostics.length, 1);
  assert.equal(wrongArgument.source.textInRange(wrongArgument.diagnostics[0].range), '"x"');
  assert.equal(analyze('"x" AND 1').expression.type, "string");
  assert.equal(analyze('+"x"').expression.type, "string");
  assert.equal(analyze('1=2').expression.type, "numeric");
  assert.equal(analyze('a').expression.type, "numeric"); // No declaration-before-use error.
  assert.equal(analyze('a$').expression.type, "string");
  assert.equal(analyze('USR "AB"').expression.type, "numeric"); // Domain is a runtime matter.
});

test("signature metadata is immutable and distinguishes zero, one and two arguments", () => {
  assert.equal(new Set(BUILTIN_SIGNATURES.map((item) => item.token.byte)).size, BUILTIN_SIGNATURES.length);
  for (const signature of BUILTIN_SIGNATURES) {
    assert.ok(Object.isFrozen(signature));
    assert.ok(Object.isFrozen(signature.arguments));
    assert.ok(["numeric", "string"].includes(signature.result));
  }
  assert.ok(Object.isFrozen(BUILTIN_SIGNATURES));
  assert.equal(BUILTIN_SIGNATURES.find((item) => item.token.spelling === "USR").arguments[0], "numeric-or-string");
});

test("all independently researched expression input bytes pass unchanged through typed encoding", () => {
  const fixture = JSON.parse(readFileSync(new URL("./fixtures/expression-rom.json", import.meta.url), "utf8"));
  for (const reference of fixture.cases) {
    const result = checked(reference.source);
    assert.equal(result.kind, "success", reference.source);
    assert.equal(Buffer.from(result.encodedProgram.programBytes.slice(5, -1)).toString("hex"), reference.encoded, reference.source);
  }
  for (const reference of fixture.binaryCases) {
    const result = checked(reference.source);
    assert.equal(result.kind, "success");
    const body = result.encodedProgram.programBytes.slice(5, -1);
    const marker = [...body].indexOf(14);
    assert.equal(body[0], 0xc4);
    assert.equal(Buffer.from(body.slice(marker + 1)).toString("hex"), reference.storage);
    assert.equal(Buffer.from(body.slice(1, marker)).toString("ascii"), reference.source.slice(3).replace(/ /g, ""));
  }
  assert.equal(checked("BIN 10000000000000000").diagnostics[0].code, DiagnosticCodes.numericOverflow);
});

test("name encoding uses validated identity rather than keyword annotations or raw bytes", () => {
  const result = checked('Some SIN name+A $');
  assert.equal(result.kind, "error"); // Numeric/string mismatch is now diagnosed.
  const valid = checked('Some SIN name+PRINT');
  assert.equal(valid.kind, "success");
  assert.equal(Buffer.from(valid.encodedProgram.programBytes.slice(5, -1)).toString("ascii"), 'somesinname+print');
});

test("malformed structures remain unbuildable after parser diagnostics are removed", () => {
  for (const text of ["POINT 1,2)", "POINT(1 2)", "POINT(1,)", "ATTR(1,2", "(1", "1+", "SIN", '"bad', "ab$"]) {
    const parsed = parseBasic(new SourceDocument("malformed", `10 PRINT ${text}`));
    const analysis = analyzeBasic({ ...parsed, diagnostics: [] });
    assert.equal(analysis.kind, "invalid", text);
    assert.ok(analysis.analysis.diagnostics.some((diagnostic) => diagnostic.severity === "error"));
  }
});

test("long left-associated chains use bounded host stack through semantic analysis and encoding", () => {
  const source = new SourceDocument("chain", '10 PRINT '+Array(1500).fill("1").join("+"));
  const analysis = analyzeBasic(parseBasic(source));
  assert.equal(analysis.kind, "buildable");
  assert.equal(encodeBasicProgram(analysis.analysis).programBytes.length, 12005);
});
