import test from 'node:test';
import assert from 'node:assert/strict';
import { createDocumentSession, SourceDocument, parseBasic, analyzeBasic, encodeBasicProgram } from '@zxcode/core';
const input = (text, version = 0, id = 'session.bas') => ({source: new SourceDocument(id, text), version});
test('session caches coherent recoverable snapshots, including invalid/incomplete source', () => {
  for (const text of ['', '10 PRINT AT 10,\n20 GO TO\n30 FOR i=1 TO\n', '10 LET a=1\n20 PRINT a\n', '10 PRINT "😀"']) {
    const original = input(text);
    const session = createDocumentSession(original);
    const snapshot = session.current;
    for (let i=0;i<10;i++) {
      assert.strictEqual(session.current, snapshot);
      assert.strictEqual(session.current.parsed, snapshot.parsed);
      assert.strictEqual(session.current.analysis, snapshot.analysis);
    }
    assert.strictEqual(snapshot.source, original.source);
    assert.strictEqual(snapshot.parsed.source, original.source);
    assert.strictEqual(snapshot.analysis.analysis.source, original.source);
    assert.strictEqual(snapshot.identity.source, original.source);
    assert.deepEqual(snapshot.parsed, parseBasic(original.source));
    const direct = analyzeBasic(snapshot.parsed);
    assert.equal(snapshot.analysis.kind, direct.kind);
    assert.deepEqual(snapshot.analysis.analysis.diagnostics, direct.analysis.diagnostics);
    assert.deepEqual(snapshot.analysis.analysis.program, direct.analysis.program);
    if (snapshot.analysis.kind === 'buildable') assert.deepEqual(encodeBasicProgram(snapshot.analysis.analysis), encodeBasicProgram(direct.analysis));
    assert.ok(Object.isFrozen(snapshot));
    assert.ok(Object.isFrozen(snapshot.identity));
    assert.ok(Object.isFrozen(session));
  }
});
test('accepted updates publish fresh identity without changing earlier source or analysis', () => {
  const session = createDocumentSession(input('10 PRINT "old"\n', 7));
  const old = session.current;
  const next = session.update(input('10 PRINT AT 1,\n', 9));
  assert.strictEqual(session.current, next);
  assert.notStrictEqual(next.identity, old.identity);
  assert.equal(next.identity.version, 9);
  assert.equal(next.analysis.kind, 'invalid');
  assert.equal(old.source.text, '10 PRINT "old"\n');
  assert.equal(old.analysis.kind, 'buildable');
  assert.strictEqual(next.targetProfile, old.targetProfile);
  assert.equal(session.update(input('10 STOP\n', 10)).analysis.kind, 'buildable');
  const twin = createDocumentSession(input('10 STOP\n', 10));
  assert.notStrictEqual(twin.current.identity, session.current.identity);
  assert.notStrictEqual(twin.current.identity.source, session.current.identity.source);
});
test('stale, invalid and cross-document updates fail atomically', () => {
  const session = createDocumentSession(input('10 STOP\n', 3));
  const previous = session.current;
  for (const bad of [input('10 CLS',3), input('10 CLS',2), input('10 CLS',4,'other.bas'), input('10 CLS',-1), input('10 CLS',NaN), input('10 CLS',Infinity), input('10 CLS',3.5), input('10 CLS',Number.MAX_SAFE_INTEGER+1), {source:'10 CLS',version:4}, null]) {
    assert.throws(() => session.update(bad));
    assert.strictEqual(session.current, previous);
  }
  for (const version of [-1,NaN,Infinity,0.1,Number.MAX_SAFE_INTEGER+1]) assert.throws(() => createDocumentSession(input('',version)), RangeError);
  assert.throws(() => createDocumentSession({source:'10 CLS',version:0}), TypeError);
  assert.equal(createDocumentSession(input('',Number.MAX_SAFE_INTEGER)).current.identity.version, Number.MAX_SAFE_INTEGER);
});
test('session copies target capabilities so caller mutation cannot alter later snapshots', () => {
  const capabilities = ['interface1'];
  const targetProfile = {id:'extended',capabilities};
  const session = createDocumentSession(input('10 CAT\n'), {targetProfile});
  assert.equal(session.current.analysis.analysis.diagnostics.length,0);
  capabilities.length=0;
  targetProfile.id='mutated';
  assert.equal(session.current.targetProfile.id,'extended');
  assert.deepEqual(session.current.targetProfile.capabilities,['interface1']);
  const next = session.update(input('10 CAT\n',1));
  assert.equal(next.analysis.analysis.diagnostics.length,0);
  assert.ok(Object.isFrozen(next.targetProfile));
  assert.ok(Object.isFrozen(next.targetProfile.capabilities));
  const base = createDocumentSession(input('10 CAT\n'));
  assert.ok(base.current.analysis.analysis.diagnostics.some(d => d.code==='ZX4001'));
  for (const profile of [{id:'',capabilities:[]}, {id:'bad',capabilities:['other']}, {id:'bad',capabilities:[,]}, {id:'bad',capabilities:null}]) assert.throws(() => createDocumentSession(input(''),{targetProfile:profile}),TypeError);
});
