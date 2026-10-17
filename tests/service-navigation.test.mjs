import test from 'node:test';
import assert from 'node:assert/strict';
import {createDocumentSession, SourceDocument, documentDefinitions, documentReferences, documentHover} from '@zxcode/core';
const snapshot = text => createDocumentSession({source:new SourceDocument('navigation.bas',text),version:0}).current;
const texts = (s, result) => result.value.map(r=>s.source.textInRange(r));
test('literal jumps navigate to checked target lines while dynamic expressions remain ordinary expressions', () => {
  const s=snapshot('10 GO TO 100\n20 GO SUB 100\n30 GO TO 50+50\n40 GO TO 999\n100 STOP\n');
  const target=s.analysis.analysis.program.lines.find(l=>l.lineNumber===100).numberRange;
  for(const offset of [s.source.text.indexOf('100'),s.source.text.indexOf('100',13)]) {
    assert.deepEqual(documentDefinitions(s,offset).value,[target]);
    assert.deepEqual(texts(s,documentReferences(s,offset)),['100','100']);
    assert.deepEqual(texts(s,documentReferences(s,offset,{includeDeclaration:true})),['100','100','100']);
    assert.match(documentHover(s,offset).value.documentation.summary,/BASIC line 100/);
  }
  const dynamic=s.source.text.indexOf('50+50');
  assert.deepEqual(documentDefinitions(s,dynamic).value,[]);
  assert.equal(documentHover(s,dynamic).value,undefined);
  const missing=s.source.text.indexOf('999');
  assert.deepEqual(documentDefinitions(s,missing).value,[]);
  assert.deepEqual(texts(s,documentReferences(s,missing)),['999']);
  assert.match(documentHover(s,missing).value.documentation.summary,/not present/);
});
test('variable/array navigation uses canonical families and preserves assignment references', () => {
  const s=snapshot('10 LET A=1\n20 LET a=a+1\n30 DIM a(3)\n40 LET a(1)=a\n50 PRINT A;a(1)\n');
  const scalar=s.source.text.indexOf('PRINT A')+6;
  assert.deepEqual(texts(s,documentDefinitions(s,scalar)),['A','a']);
  assert.deepEqual(texts(s,documentReferences(s,scalar)),['A','a','a','a','A']);
  assert.match(documentHover(s,scalar).value.documentation.summary,/a: numeric variable/);
  const array=s.source.text.lastIndexOf('a(1)');
  assert.deepEqual(texts(s,documentDefinitions(s,array)),['a']);
  assert.equal(documentDefinitions(s,array).value[0].start,s.source.text.indexOf('DIM a')+4);
  assert.equal(documentReferences(s,array).value.length,2);
  assert.equal(documentReferences(s,array,{includeDeclaration:true}).value.length,3);
  assert.match(documentHover(s,array).value.documentation.summary,/numeric array/);
});
test('FN and formal navigation follows original first-match binding and keeps scopes separate', () => {
  const s=snapshot('10 DEF FN f(x,x)=x\n20 DEF FN f(x)=x\n30 DEF FN g(x)=FN f(x,1)+x\n40 PRINT FN f(1,2);FN g(1)\n');
  const call=s.source.text.lastIndexOf('FN f')+3;
  const first=s.source.text.indexOf('FN f')+3;
  assert.equal(documentDefinitions(s,call).value[0].start,first);
  assert.match(documentHover(s,call).value.documentation.summary,/FN f: numeric function/);
  const body=s.source.text.indexOf(')=x')+2;
  const formal=s.source.text.indexOf('(x')+1;
  assert.equal(documentDefinitions(s,body).value[0].start,formal);
  assert.equal(documentReferences(s,body).value.length,1);
  assert.equal(documentReferences(s,body,{includeDeclaration:true}).value.length,3);
  const gbody=s.source.text.indexOf('+x')+1;
  assert.equal(documentReferences(s,gbody).value.length,2);
  assert.match(documentHover(s,gbody).value.documentation.summary,/numeric formal parameter/);
});
test('unresolved symbols, opaque text and incomplete documents return useful or empty results', () => {
  const s=snapshot('10 PRINT unknown;FN f(1)\n20 PRINT AT 1,\n30 PRINT "unknown"\n40 REM unknown FN f\n');
  const variable=s.source.text.indexOf('unknown');
  assert.deepEqual(documentDefinitions(s,variable).value,[]);
  assert.match(documentHover(s,variable).value.documentation.summary,/numeric variable/);
  const fn=s.source.text.indexOf('FN f')+3;
  assert.deepEqual(documentDefinitions(s,fn).value,[]);
  assert.deepEqual(documentHover(s,fn).value.documentation.remarks,['No DEF FN definition in this document.']);
  for(const offset of [s.source.text.indexOf('"unknown"')+1,s.source.text.lastIndexOf('unknown')]) {
    assert.equal(documentHover(s,offset).value,undefined);
    assert.deepEqual(documentDefinitions(s,offset).value,[]);
    assert.deepEqual(documentReferences(s,offset).value,[]);
  }
});
test('query results keep snapshot identity, immutable ranges and checked offsets after updates', () => {
  const session=createDocumentSession({source:new SourceDocument('navigation.bas','10 LET a=1\n20 PRINT a\n'),version:1});
  const old=session.current;
  const offset=old.source.text.lastIndexOf('a');
  const before=documentDefinitions(old,offset);
  for(const query of [documentDefinitions,documentReferences,documentHover]) {
    const result=query(old,offset);
    assert.strictEqual(result.snapshot,old.identity);
    assert.ok(Object.isFrozen(result));
    for(const bad of [-1,0.5,NaN,old.source.text.length+1]) assert.throws(()=>query(old,bad),RangeError);
    assert.doesNotThrow(()=>query(old,old.source.text.length));
  }
  session.update({source:new SourceDocument(old.source.id,'10 LET b=2'),version:2});
  assert.deepEqual(documentDefinitions(old,offset),before);
  assert.ok(Object.isFrozen(before.value));
  assert.ok(Object.isFrozen(before.value[0]));
});
test('hover preserves string types for scalar/array storage, FN results and local formals', () => {
  const s=snapshot('10 DIM b$(2,3)\n20 LET c$="x": PRINT b$(1);c$\n30 DEF FN f$(s$)=s$\n40 PRINT FN f$(c$)\n');
  for(const [offset,expected] of [
    [s.source.text.indexOf('c$'),'c$: string variable'],
    [s.source.text.indexOf('b$'),'b$: string variable / array'],
    [s.source.text.lastIndexOf('FN f$')+3,'FN f$: string function'],
    [s.source.text.indexOf(')=s$')+2,'s$: string formal parameter']
  ]) assert.ok(documentHover(s,offset).value.documentation.summary.includes(expected));
});
