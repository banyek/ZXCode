import test from 'node:test';
import assert from 'node:assert/strict';
import { createDocumentSession, documentDiagnostics, checkProgram, SourceDocument, M1_BASIC_BYTE_LIMIT, createDiagnostic } from '@zxcode/core';
const snapshot = text => createDocumentSession({source:new SourceDocument('diagnostics.bas',text),version:0}).current;
test('snapshot diagnostics agree with shared check/build validation on complete and incomplete source', () => {
  for (const text of [
    '', '10 PRINT "hello"\n', '10 PRINT AT 10,\n20 GO TO\n30 FOR i=1 TO\n',
    '10 LET a="string"\n', '10 PRINT "😀"\n', '10 PRINT 1E128\n',
    '10 GO TO 999\n', '10 PRINT FN f(1)\n', '10 CAT\n', '10 CLS\n10 STOP\n',
    '10 PRINT "'+'A'.repeat(M1_BASIC_BYTE_LIMIT)+'"\n',
    '10 PRINT "'+'A'.repeat(M1_BASIC_BYTE_LIMIT)+'"\n20 PRINT AT\n'
  ]) {
    const analyzed = snapshot(text);
    const result = documentDiagnostics(analyzed);
    const direct = checkProgram(analyzed.source);
    assert.deepEqual(result.value, direct.diagnostics, text.slice(0,100));
    assert.strictEqual(result.snapshot, analyzed.identity);
    assert.strictEqual(documentDiagnostics(analyzed),result);
    assert.ok(Object.isFrozen(result));
    assert.ok(Object.isFrozen(result.value));
    for (const diagnostic of result.value) {
      assert.equal(diagnostic.range.sourceId, analyzed.source.id);
      assert.ok(diagnostic.range.start>=0 && diagnostic.range.end<=text.length);
      assert.match(diagnostic.code,/^ZX\d{4}$/);
    }
  }
});
test('encoder budget errors appear once and remain attached to their original snapshot', () => {
  const session = createDocumentSession({source:new SourceDocument('budget.bas','10 PRINT "'+'A'.repeat(M1_BASIC_BYTE_LIMIT)+'"'),version:1});
  const old = session.current;
  assert.equal(old.analysis.kind,'buildable');
  const oldResult = documentDiagnostics(old);
  assert.equal(oldResult.value.filter(d=>d.code==='ZX2004').length,1);
  const next = session.update({source:new SourceDocument('budget.bas','10 PRINT "ok"'),version:2});
  assert.deepEqual(documentDiagnostics(next).value,[]);
  assert.strictEqual(documentDiagnostics(old),oldResult);
  assert.strictEqual(oldResult.snapshot.source,old.source);
  assert.notStrictEqual(oldResult.snapshot,documentDiagnostics(next).snapshot);
});
test('codes, categories, severities, related ranges and capability metadata survive without formatting', () => {
  const incomplete = snapshot('10 PRINT AT');
  const diagnostics = [
    ...incomplete.analysis.analysis.diagnostics,
    createDiagnostic({code:'ZX9001',category:'tooling',severity:'hint',message:'Tooling hint',range:incomplete.source.range(0,2),related:[{message:'Related location',range:incomplete.source.range(3,8)}]}),
    createDiagnostic({code:'ZX9002',category:'tooling',severity:'information',message:'Tooling information',range:incomplete.source.range(0)})
  ];
  const extended = Object.freeze({...incomplete,analysis:Object.freeze({kind:'invalid',analysis:Object.freeze({...incomplete.analysis.analysis,diagnostics:Object.freeze(diagnostics)})})});
  const result = documentDiagnostics(extended);
  assert.strictEqual(result.value,extended.analysis.analysis.diagnostics);
  assert.equal(result.value.at(-2).related[0].range.start,3);
  assert.equal(result.value.at(-1).severity,'information');
  const warning = documentDiagnostics(snapshot('10 CAT')).value.find(d=>d.code==='ZX4001');
  assert.equal(warning.category,'compatibility');
  assert.equal(warning.severity,'warning');
  assert.equal(warning.capability,'interface1');
  assert.ok(!warning.message.includes('diagnostics.bas:'));
});
