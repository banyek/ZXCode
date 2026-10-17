import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { analyzeBasic, checkProgram, DiagnosticCodes, parseBasic, SourceDocument } from "@zxcode/core";

function parsed(body) { return parseBasic(new SourceDocument("print-items", `10 ${body}`)); }

test("PRINT/LPRINT items and doubled quotes match forty-one independent program images", () => {
  const fixture = JSON.parse(readFileSync(new URL("./fixtures/print.json", import.meta.url), "utf8"));
  for (const reference of fixture.cases) {
    const result = checkProgram(new SourceDocument("reference", reference.source));
    assert.equal(result.kind, "success", reference.source);
    assert.equal(Buffer.from(result.encodedProgram.programBytes).toString("hex"), reference.programHex, reference.source);
  }
});

test("item boundaries, types and shared LPRINT grammar match fifty-six original-ROM probes", () => {
  const fixture = JSON.parse(readFileSync(new URL("./fixtures/print-rom.json", import.meta.url), "utf8"));
  for (const reference of fixture.cases) {
    const result = checkProgram(new SourceDocument("rom-print", reference.source));
    if (reference.statements !== undefined) {
      assert.equal(result.kind, "success", reference.source);
      assert.equal(Buffer.from(result.encodedProgram.programBytes.slice(4, -1)).toString("hex"), reference.encoded, reference.source);
    } else assert.equal(result.kind, "error", reference.source);
  }
});

test("formatting, channels, expressions and separators retain distinct semantic item kinds", () => {
  const input = parsed('PRINT AT 1,2; TAB 4; INK 2; #2; "x"');
  assert.deepEqual(input.diagnostics, []);
  const result = analyzeBasic(input);
  assert.equal(result.kind, "buildable");
  const items = result.analysis.program.lines[0].statements[0].items;
  assert.deepEqual(items.map((item) => item.kind), ['print-at', 'print-separator', 'print-tab', 'print-separator', 'print-control', 'print-separator', 'print-channel', 'print-separator', 'print-expression']);
  assert.equal(items[0].row.type, "numeric");
  assert.equal(items[0].column.type, "numeric");
  assert.equal(items[4].token.byte, 0xd9);
  assert.equal(input.source.textInRange(items[6].range), '#2');
  assert.equal(items[8].expression.type, "string");
  const empty = parsed('PRINT ,;').syntax.lines[0].statements[0].items;
  assert.deepEqual(empty.map((item) => item.kind), ['print-empty', 'print-separator', 'print-empty', 'print-separator', 'print-empty']);
  assert.ok(empty.filter((item) => item.kind === "print-empty").every((item) => item.range.start === item.range.end));
  assert.equal(parsed('LPRINT').syntax.lines[0].statements[0].kind, "lprint");
});

test("decoded quote parts preserve original content and precise diagnostics after an interior quote", () => {
  const input = parsed('PRINT "a""b"');
  const literal = input.syntax.lines[0].statements[0].items[0].expression;
  assert.equal(literal.value, 'a"b');
  assert.equal(input.source.textInRange(literal.contentRange), 'a""b');
  assert.deepEqual(literal.parts.map((part) => [part.value, input.source.textInRange(part.range)]), [['a', 'a'], ['"', '""'], ['b', 'b']]);
  const analysis = analyzeBasic(input);
  assert.deepEqual(analysis.analysis.program.lines[0].statements[0].items[0].expression.bytes, [97, 34, 98]);
  assert.ok(Object.isFrozen(literal.parts));
  const invalid = parsed('PRINT "a""😀"');
  const result = analyzeBasic(invalid);
  const diagnostic = result.analysis.diagnostics.find((item) => item.code === DiagnosticCodes.unsupportedCharacter);
  assert.equal(invalid.source.textInRange(diagnostic.range), '😀');
  assert.equal(diagnostic.range.start, invalid.source.text.indexOf('😀'));
  assert.equal(diagnostic.range.end - diagnostic.range.start, 2);
});

test("malformed item syntax recovers through later items/statements and cannot bypass validation", () => {
  for (const body of ['PRINT AT 1 2', 'PRINT AT 1,', 'PRINT TAB', 'PRINT INK', 'PRINT #', 'PRINT AT 1,2"x"', 'PRINT TAB 1"x"', 'PRINT #2"x"', 'PRINT "a" "b"', 'PRINT """']) {
    const input = parseBasic(new SourceDocument("bad-print", `10 ${body}: STOP\n20 CLS`));
    // An unfinished string owns the rest of its physical line; other malformed items recover at colon.
    if (body !== 'PRINT """') assert.equal(input.syntax.lines[0].statements[1].kind, "stop", body);
    assert.equal(input.syntax.lines[1].statements[0].kind, "cls");
    assert.equal(analyzeBasic({ ...input, diagnostics: [] }).kind, "invalid", body);
  }
  const recovered = parsed('PRINT "a" "bad";2').syntax.lines[0].statements[0];
  assert.equal(recovered.complete, false);
  assert.equal(recovered.items.at(-1).expression.lexeme, "2");
});

test("formatting and channel contexts use numeric typing rather than generic arguments", () => {
  for (const body of ['PRINT AT "x",1', 'PRINT AT 1,"x"', 'PRINT TAB "x"', 'PRINT INK "x"', 'PRINT #"x"', 'LPRINT AT a$,1']) {
    const result = analyzeBasic(parsed(body));
    assert.equal(result.kind, "invalid");
    assert.ok(result.analysis.diagnostics.some((diagnostic) => diagnostic.code === DiagnosticCodes.typeMismatch), body);
  }
  assert.equal(checkProgram(parsed('PRINT AT POINT(1,2),3,4').source).kind, "success");
  assert.equal(checkProgram(parsed('LPRINT #2; OVER 1; AT 1,2; "x"').source).kind, "success");
});
