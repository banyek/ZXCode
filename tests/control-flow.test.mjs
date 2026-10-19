import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { analyzeBasic, buildTap, checkProgram, createDocumentSession, exportBasicSource, formatDocument, DiagnosticCodes, parseBasic, SourceDocument } from "@zxcode/core";

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
  for (const body of ['IF 1 THEN STOP ELSE CLS']) assert.equal(checkProgram(parsed(`10 ${body}`).source).kind, "error");
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


test("jump aliases share canonical bytes, formatting and original source ranges", () => {
  for (const [alias, canonical] of [["GOTO", "GO TO"], ["GOSUB", "GO SUB"], ["goto", "GO TO"], ["GoSuB", "GO SUB"]]) {
    const source = new SourceDocument("alias", `10 IF 1 THEN ${alias} 100: PRINT "GOTO GOSUB"\n100 REM GOTO GOSUB : "raw`);
    const canonicalSource = new SourceDocument("canonical", source.text.replace(alias + " 100", canonical + " 100"));
    const options = { filenameBytes: new TextEncoder().encode("ALIASES   "), autostart: 10 };
    const actual = buildTap(source, options), expected = buildTap(canonicalSource, options);
    assert.equal(actual.kind, "success");
    assert.equal(expected.kind, "success");
    assert.deepEqual(actual.encodedProgram.programBytes, expected.encodedProgram.programBytes);
    assert.deepEqual(actual.tap, expected.tap);
    const formatted = formatDocument(createDocumentSession({source, version: 1}).current).value;
    assert.equal(formatted.kind, "formatted");
    assert.equal(formatted.resultText, canonicalSource.text);
    const exported = exportBasicSource(actual.encodedProgram.programBytes);
    assert.equal(exported.kind, "exact");
    assert.ok(exported.candidateSource.includes(canonical + " "));
    const input = parseBasic(source);
    const jump = input.syntax.lines[0].statements[0].thenStatements[0];
    assert.equal(source.textInRange(jump.range), `${alias} 100`);
    assert.equal(source.textInRange(jump.target.range), "100");
    const token = input.syntax.lines[0].tokens.find(token => token.text === alias);
    assert.equal(token.romToken.spelling, canonical);
    assert.equal(source.textInRange(token.range), alias);
  }
});

test("malformed aliases produce the same diagnostics on the same source fragments", () => {
  for (const [alias, canonical] of [["GOTO", "GO TO"], ["GOSUB", "GO SUB"]]) {
    for (const tail of ["", ' "x"', " a$", " 1,2", " (1", " +"]) {
      const diagnostics = command => {
        const source = new SourceDocument("bad", `10 ${command}${tail}`);
        const result = checkProgram(source);
        assert.equal(result.kind, "error", source.text);
        return result.diagnostics.map(({code, severity, message, range}) => ({code, severity, message, text: source.textInRange(range).replace(command, canonical)}));
      };
      assert.deepEqual(diagnostics(alias), diagnostics(canonical));
    }
  }
  for (const body of ["GOTO100", "GOSUB100", "GO2 100"]) assert.equal(checkProgram(parsed(`10 ${body}`).source).kind, "error");
});


test("alias spellings in variable names, strings and raw tails retain their text", () => {
  const source = new SourceDocument("contexts", '10 LET goto=1: LET gosub=2: PRINT "GOTO GOSUB"\n20 IF goto THEN REM GOTO GOSUB : "raw');
  const result = formatDocument(createDocumentSession({source, version: 1}).current).value;
  assert.equal(result.kind, "formatted");
  assert.equal(result.resultText, source.text);
  assert.ok(parseBasic(source).syntax.lines[0].tokens.filter(token => ["goto", "gosub"].includes(token.text)).every(token => token.romToken === undefined));
});
