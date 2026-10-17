import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { analyzeBasic, checkProgram, parseBasic, SourceDocument } from '@zxcode/core';
const parsed = (body) => parseBasic(new SourceDocument('storage', `10 ${body}`));
const check = (body) => checkProgram(parsed(body).source);
test('listing/cassette encoding matches twenty-seven independent program images', () => {
  for (const item of JSON.parse(readFileSync(new URL('./fixtures/storage.json', import.meta.url), 'utf8')).cases) {
    const result = checkProgram(new SourceDocument('reference', item.source));
    assert.equal(result.kind, 'success', item.source);
    assert.equal(Buffer.from(result.encodedProgram.programBytes).toString('hex'), item.programHex, item.source);
  }
});
test('listing/cassette boundaries match forty-eight original-ROM syntax observations', () => {
  for (const item of JSON.parse(readFileSync(new URL('./fixtures/storage-rom.json', import.meta.url), 'utf8')).cases) assert.equal(checkProgram(new SourceDocument('rom', item.source)).kind, item.statements === undefined ? 'error' : 'success', item.source);
});
test('listing retains explicit stream separators and optional starting lines', () => {
  for (const separator of [',',';']) {
    const input = parsed(`LLIST #a${separator}b+2`);
    assert.deepEqual(input.diagnostics, []);
    const node = input.syntax.lines[0].statements[0];
    assert.equal(node.kind, 'llist');
    assert.equal(node.separator.text, separator);
    assert.equal(input.source.textInRange(node.separator.range), separator);
    assert.equal(node.startLine.kind, 'binary-expression');
    assert.equal(check(`LLIST #a${separator}b+2`).kind, 'success');
  }
  for (const body of ['LIST', 'LIST #2', 'LIST 15']) assert.deepEqual(check(body).diagnostics, [], body);
});
test('cassette suffix variants preserve omission and native tokens', () => {
  for (const [body, kind] of [['SAVE "x"', 'program'], ['SAVE "x" LINE 10','line'], ['LOAD "x" DATA a$()','array'], ['SAVE "x" SCREEN$','screen'], ['LOAD "x" CODE','code']]) {
    const input = parsed(body);
    assert.deepEqual(input.diagnostics, []);
    const node = input.syntax.lines[0].statements[0];
    assert.equal(node.form.kind, kind);
    const checked = analyzeBasic(input);
    assert.equal(checked.kind, 'buildable');
    if (kind === 'array') assert.equal(checked.analysis.program.lines[0].statements[0].form.identity.key, 'string:a$');
    if (kind === 'code') {
      assert.equal(node.form.start, undefined);
      assert.equal(node.form.length, undefined);
      assert.equal(input.source.textInRange(node.form.range), 'CODE');
    }
  }
});
test('cassette filenames and operands share expression typing and FN resolution', () => {
  for (const body of ['SAVE STR$ a CODE b,c', 'SAVE STR$ CODE "x" CODE b,c', 'DEF FN f$(x)=STR$ x: SAVE FN f$(2) LINE 10', 'SAVE ""', 'LOAD "longer than ten characters"']) assert.equal(check(body).kind, 'success', body);
  for (const body of ['SAVE 2', 'LOAD a', 'SAVE "x" LINE "a"', 'LOAD "x" CODE "a"', 'LOAD "x" CODE 1,"a"', 'LIST "a"', 'LIST #"a"']) {
    const result = check(body);
    assert.equal(result.kind, 'error', body);
    assert.ok(result.diagnostics.some((item) => item.category === 'semantic'), body);
  }
});
test('malformed suffixes and listing forms recover without diagnostic-stripping bypass', () => {
  for (const body of ['LIST 1,2', 'LIST #2,', 'LIST 1 TO 2', 'SAVE', 'SAVE "x" CODE', 'SAVE "x" CODE 1', 'SAVE "x" CODE 1,', 'LOAD "x" LINE 1', 'MERGE "x" CODE', 'MERGE "x" SCREEN$', 'MERGE "x" DATA a()', 'LOAD "x" DATA a(1)', 'LOAD "x" DATA a()$', 'LOAD "x" DATA long()', 'SAVE "x" SCREEN$ CODE 1,2']) {
    const input = parsed(`${body}: PRINT 2`);
    assert.ok(input.diagnostics.length > 0, body);
    assert.equal(analyzeBasic(Object.freeze({ ...input, diagnostics: Object.freeze([]) })).kind, 'invalid', body);
    assert.equal(input.syntax.lines[0].statements.at(-1).kind, 'print');
  }
});
