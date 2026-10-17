import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { analyzeBasic, checkProgram, DiagnosticCodes, parseBasic, SourceDocument } from '@zxcode/core';

test('REM bytes and ignored syntax match eleven original-ROM observations', () => {
  const fixture = JSON.parse(readFileSync(new URL('./fixtures/rem-rom.json', import.meta.url), 'utf8'));
  for (const entry of fixture.cases) {
    const result = checkProgram(new SourceDocument('rem', entry.source));
    assert.equal(result.kind, 'success', entry.source);
    assert.deepEqual(result.diagnostics, []);
    assert.equal(Buffer.from(result.encodedProgram.programBytes.slice(4, -1)).toString('hex'), entry.encoded, entry.source);
    assert.equal(result.encodedProgram.lines[0].statements.length, entry.statements);
  }
});
test('REM retains exact tail source and bytes through physical line boundaries', () => {
  const text = '10 REM  MiXeD : "unfinished  \r\n20 PRINT 2';
  const source = new SourceDocument('raw', text);
  const parsed = parseBasic(source);
  assert.deepEqual(parsed.diagnostics, []);
  const rem = parsed.syntax.lines[0].statements[0];
  assert.equal(rem.kind, 'rem');
  assert.equal(rem.text, '  MiXeD : "unfinished  ');
  assert.equal(source.textInRange(rem.tailRange), rem.text);
  assert.equal(source.textInRange(rem.range), 'REM'+rem.text);
  assert.equal(parsed.syntax.lines[1].statements[0].kind, 'print');
  const checked = analyzeBasic(parsed);
  assert.equal(checked.kind, 'buildable');
  const semantic = checked.analysis.program.lines[0].statements[0];
  assert.ok(Object.isFrozen(semantic.bytes));
  assert.equal(Buffer.from(semantic.bytes).toString('ascii'), rem.text);
});
test('bare REM adds no space or hidden payload and keyword-looking names stay variables', () => {
  const source = new SourceDocument('empty', '10 REM');
  const parsed = parseBasic(source);
  const node = parsed.syntax.lines[0].statements[0];
  assert.equal(node.tailRange.start, node.tailRange.end);
  const result = checkProgram(source);
  assert.equal(result.kind, 'success');
  assert.equal(Buffer.from(result.encodedProgram.programBytes).toString('hex'), '000a0200ea0d');
  assert.equal(checkProgram(new SourceDocument('names', '10 LET some THEN REM name=1')).kind, 'success');
});
test('REM character coverage reports exact UTF-16 ranges without transforming the raw tail', () => {
  const source = new SourceDocument('characters', '10 REM a😀é\t`z');
  const parsed = parseBasic(source);
  assert.deepEqual(parsed.diagnostics, []);
  const result = analyzeBasic(parsed);
  assert.equal(result.kind, 'invalid');
  assert.deepEqual(result.analysis.diagnostics.map((item) => [item.code, item.category, source.textInRange(item.range)]), ['😀','é','\t','`'].map((text) => [DiagnosticCodes.unsupportedCharacter, 'compatibility', text]));
  assert.equal(parsed.syntax.lines[0].statements[0].text, ' a😀é\t`z');
});
