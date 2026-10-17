import test from 'node:test';
import assert from 'node:assert/strict';
import adapter from '../packages/extension/dist/documents.cjs';
const {EditorDocuments}=adapter;
function document(uri,text,version=1) {
  const state={text};
  return {uri:{toString:()=>uri},version,getText:()=>state.text,state};
}
test('editor adapter reuses same-version snapshots and updates through the shared parser/model',()=>{
  const documents=new EditorDocuments();
  const doc=document('untitled:test.bas','10 PRINT "hello"');
  const first=documents.snapshot(doc);
  assert.strictEqual(documents.snapshot(doc),first);
  assert.equal(first.identity.documentId,'untitled:test.bas');
  assert.equal(first.analysis.kind,'buildable');
  doc.state.text='10 PRINT AT 10,';doc.version++;
  const next=documents.snapshot(doc);
  assert.notStrictEqual(next.identity,first.identity);
  assert.equal(next.analysis.kind,'invalid');
  assert.ok(next.analysis.analysis.diagnostics.some(d=>d.code==='ZX1101'));
  assert.equal(first.source.text,'10 PRINT "hello"');
  doc.version=1;
  assert.throws(()=>documents.snapshot(doc),RangeError);
  doc.version=2;
  assert.strictEqual(documents.snapshot(doc),next);
});
test('reopened editor instances reset version ownership and old close events cannot evict them',()=>{
  const documents=new EditorDocuments();
  const old=document('file:///source.bas','10 CLS',5);
  const before=documents.snapshot(old);
  const reopened=document('file:///source.bas','10 STOP',1);
  const after=documents.snapshot(reopened);
  assert.notStrictEqual(before.identity,after.identity);
  assert.equal(after.identity.version,1);
  documents.close(old);
  assert.strictEqual(documents.snapshot(reopened),after);
  documents.close(reopened);
  assert.notStrictEqual(documents.snapshot(reopened).identity,after.identity);
  documents.dispose();
  assert.throws(()=>documents.snapshot(reopened),/disposed/);
  assert.doesNotThrow(()=>documents.dispose());
});
