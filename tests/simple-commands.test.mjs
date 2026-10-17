import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { analyzeBasic, checkProgram, DiagnosticCodes, parseBasic, SIMPLE_COMMANDS, SourceDocument } from "@zxcode/core";
import { emitSimpleCommand } from "../packages/core/dist/encoding/simple-commands.js";

function parsed(text) { return parseBasic(new SourceDocument("commands", text)); }

test("all thirty simple ROM commands have independent parser and encoder fixtures", () => {
  const fixture = JSON.parse(readFileSync(new URL("./fixtures/simple-commands.json", import.meta.url), "utf8"));
  const covered = new Set();
  for (const reference of fixture.cases) {
    const input = parsed(reference.source);
    assert.deepEqual(input.diagnostics, [], reference.source);
    const statement = input.syntax.lines[0].statements[0];
    const name = statement.kind === "simple-command" ? statement.definition.token.spelling : statement.kind.toUpperCase();
    covered.add(name);
    const analysis = analyzeBasic(input);
    if (statement.kind === "simple-command" && statement.definition.pendingCapabilityPolicy) {
      assert.equal(analysis.kind, "invalid");
      const body = [];
      emitSimpleCommand(analysis.analysis.program.lines[0].statements[0], (byte) => body.push(byte));
      body.push(13);
      const image = Buffer.from([0, 10, body.length & 255, body.length >> 8, ...body]);
      assert.equal(image.toString("hex"), reference.programHex, reference.source);
    } else {
      const result = checkProgram(input.source);
      assert.equal(result.kind, "success", reference.source);
      assert.equal(Buffer.from(result.encodedProgram.programBytes).toString("hex"), reference.programHex, reference.source);
    }
  }
  assert.equal(SIMPLE_COMMANDS.length, 30);
  assert.deepEqual([...covered].sort(), SIMPLE_COMMANDS.map((definition) => definition.token.spelling).sort());
});

test("graphics colour prefix is an ordered grammar with retained control separators", () => {
  const input = parsed('10 PLOT INK a; PAPER b,1,2: DRAW OVER 1;3,4,PI: CIRCLE 5,6,7');
  assert.deepEqual(input.diagnostics, []);
  const [plot, draw, circle] = input.syntax.lines[0].statements;
  assert.equal(plot.definition.shape, "plot");
  assert.deepEqual(plot.controls.map((control) => [control.token.spelling, control.separator]), [["INK", ";"], ["PAPER", ","]]);
  assert.equal(input.source.textInRange(plot.controls[0].range), "INK a;");
  assert.equal(draw.operands.length, 3);
  assert.equal(circle.operands.length, 3);
  assert.equal(checkProgram(input.source).kind, "success");
});

test("numeric and string operand contexts use shared expression type diagnostics", () => {
  for (const body of ['BORDER "x"', 'PAUSE a$', 'INK "x"', 'POKE "x",1', 'BEEP 1,"x"', 'PLOT 1,a$', 'DRAW INK "x";1,2', 'CIRCLE 1,2,a$', 'FORMAT 1', 'ERASE 1', 'MOVE "x",1', 'OPEN # "x","s"', 'OPEN # 4,1', 'CLOSE # "x"']) {
    const analysis = analyzeBasic(parsed(`10 ${body}`));
    assert.equal(analysis.kind, "invalid", body);
    assert.ok(analysis.analysis.diagnostics.some((diagnostic) => diagnostic.code === DiagnosticCodes.typeMismatch), body);
  }
});

test("missing/extra operands and graphics delimiters recover and cannot bypass validation", () => {
  for (const body of ['RETURN 1', 'BORDER', 'INK', 'POKE 1', 'POKE 1 2', 'BEEP 1,2,3', 'PLOT 1', 'PLOT 1;2', 'PLOT INK 1 2,3', 'DRAW 1,2,', 'DRAW 1,2,3,4', 'CIRCLE 1,2', 'CIRCLE 1,2,3,4', 'MOVE "a" "b"', 'OPEN 4,"s"', 'CLOSE 4', 'OPEN # 4', 'CLEAR 1,2']) {
    const input = parsed(`10 ${body}: STOP\n20 CLS`);
    assert.ok(input.diagnostics.length > 0, body);
    assert.equal(input.syntax.lines[0].statements[1].kind, "stop", body);
    assert.equal(input.syntax.lines[1].statements[0].kind, "cls", body);
    assert.equal(analyzeBasic({ ...input, diagnostics: [] }).kind, "invalid", body);
  }
});

test("omitted optional operands stay omitted and capability-policy coverage stays explicit", () => {
  for (const body of ['RUN', 'RANDOMIZE', 'CLEAR', 'RESTORE']) {
    const input = parsed(`10 ${body}`);
    assert.equal(input.syntax.lines[0].statements[0].operands.length, 0);
    assert.equal(checkProgram(input.source).encodedProgram.programBytes.length, 6);
  }
  for (const body of ['CAT', 'FORMAT "x"', 'ERASE "x"', 'MOVE "x","y"', 'OPEN # 4,"s"', 'CLOSE # 4']) {
    const input = parsed(`10 ${body}`);
    assert.deepEqual(input.diagnostics, []);
    const result = checkProgram(input.source);
    assert.equal(result.kind, "error");
    assert.ok(result.diagnostics.some((diagnostic) => diagnostic.code === DiagnosticCodes.unsupportedSyntax && diagnostic.message.includes("capability")));
  }
});

test("special command families still require their own parsers", () => {
  for (const body of ['LIST 1,2', 'SAVE "x"']) {
    assert.ok(parsed(`10 ${body}`).diagnostics.some((diagnostic) => diagnostic.code === DiagnosticCodes.unsupportedSyntax), body);
  }
});
