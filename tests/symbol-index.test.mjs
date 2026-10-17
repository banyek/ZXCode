import test from 'node:test';
import assert from 'node:assert/strict';
import {createDocumentSession, documentSymbolIndex, SourceDocument} from '@zxcode/core';
function analyze(text) {
  const session = createDocumentSession({source:new SourceDocument('symbols.bas',text),version:0});
  const result = documentSymbolIndex(session.current);
  return {session,result,index:result.value,source:session.current.source};
}
const roles = symbol => symbol.occurrences.map(o=>o.role);
test('canonical families index scalar/array/control writes and reads without inventing declarations', () => {
  const {index,source,session} = analyze('10 DIM a(3): DIM b$(3,8)\n20 LET A=1: LET B$="x": LET a(1)=a: LET b$(1,2 TO 3)="xy"\n30 FOR A=1 TO 3: NEXT a\n40 INPUT a,b$(1),a(2)\n50 DATA 1,"x": READ a,a(1),b$\n60 SAVE "n" DATA a(): LOAD "n" DATA a(): VERIFY "n" DATA a()\n70 PRINT a(1);b$\n');
  assert.equal(session.current.analysis.kind,'buildable',JSON.stringify(session.current.analysis.analysis.diagnostics));
  const numeric = index.get('numeric:a');
  assert.deepEqual(numeric.kinds,['variable']);
  assert.ok(roles(numeric).includes('write'));
  assert.ok(roles(numeric).includes('read'));
  assert.ok(!roles(numeric).includes('definition'));
  const next = numeric.occurrences.find(o=>o.range.start===source.text.indexOf('NEXT a')+5);
  assert.equal(next.role,'read');
  const loop = numeric.occurrences.find(o=>o.range.start===source.text.indexOf('FOR A')+4);
  assert.equal(loop.role,'write');
  const array = index.get('numeric-array:a');
  assert.equal(array.occurrences.filter(o=>o.role==='definition').length,1);
  assert.deepEqual(roles(array),['definition','write','write','write','read','write','read','read']);
  const string = index.get('string:b$');
  assert.deepEqual(string.kinds,['array','variable']);
  assert.equal(string.occurrences.filter(o=>o.role==='definition').length,1);
  for(const occurrence of index.occurrences) if(!occurrence.key.startsWith('line:')) assert.match(source.textInRange(occurrence.range),/^[abAB]\$?$/);
});
test('FN calls, global names and owner-scoped formal definitions/uses retain binding ranges', () => {
  const {index,source,session} = analyze('10 DEF FN f(x)=x+a\n20 DEF FN g(x)=FN f(x)+x\n30 LET x=2: PRINT FN f(x);FN g(x)\n');
  assert.equal(session.current.analysis.kind,'buildable');
  for(const key of ['function:f','function:g']) {
    const symbol=index.get(key);
    assert.equal(symbol.kinds[0],'function');
    assert.equal(symbol.occurrences.filter(o=>o.role==='definition').length,1);
    const definition = symbol.occurrences.find(o=>o.role==='definition').range;
    for(const use of symbol.occurrences.filter(o=>o.role==='read')) assert.deepEqual(use.definitionRange,definition);
  }
  const formals=index.symbols.filter(s=>s.identity?.family==='formal');
  assert.equal(formals.length,2);
  assert.notEqual(formals[0].key,formals[1].key);
  assert.deepEqual(formals.map(s=>roles(s)).sort((a,b)=>a.length-b.length),[['definition','read'],['definition','read','read']]);
  for(const formal of formals) {
    const definition=formal.occurrences.find(o=>o.role==='definition').range;
    for(const use of formal.occurrences.filter(o=>o.role==='read')) assert.deepEqual(use.definitionRange,definition);
    for(const occurrence of formal.occurrences) assert.equal(source.textInRange(occurrence.range),'x');
  }
  assert.deepEqual(roles(index.get('numeric:x')),['write','read','read']);
});
test('only semantic literal jump relations create static line references', () => {
  const {index,session}=analyze('10 GO TO 100: GO SUB 999\n20 GO TO 50+50\n30 GO TO (100)\n40 GO TO BIN 1100100\n100 STOP\n');
  assert.equal(session.current.analysis.kind,'buildable');
  assert.deepEqual(roles(index.get('line:100')),['read','read','definition']);
  assert.deepEqual(roles(index.get('line:999')),['read']);
  assert.equal(index.get('line:50'),undefined);
  assert.equal(index.get('line:999').occurrences[0].definitionRange,undefined);
  const target=index.get('line:100').occurrences.find(o=>o.role==='definition').range;
  for(const use of index.get('line:100').occurrences.filter(o=>o.role==='read')) assert.deepEqual(use.definitionRange,target);
});
test('valid retained nodes index in incomplete documents while string and REM text remain opaque', () => {
  const {index,session}=analyze('10 LET actual=1\n20 PRINT AT 1,\n30 PRINT actual;"phantom FN z(a)"\n40 REM LET phantom=1: DEF FN z(a)=a\n');
  assert.equal(session.current.analysis.kind,'invalid');
  assert.deepEqual(roles(index.get('numeric:actual')),['write','read']);
  assert.equal(index.get('numeric:phantom'),undefined);
  assert.equal(index.get('function:z'),undefined);
  assert.equal(index.symbols.filter(s=>s.kinds.includes('line')).length,4);
});
test('lookup checks offsets, retains name-end carets and protects cached/old index data', () => {
  const {session,result,index,source}=analyze('10 LET alpha=1\n20 PRINT alpha\n');
  assert.strictEqual(documentSymbolIndex(session.current),result);
  assert.strictEqual(result.snapshot,session.current.identity);
  const offset=source.text.indexOf('alpha');
  assert.equal(index.at(offset).key,'numeric:alpha');
  assert.equal(index.at(offset+5).key,'numeric:alpha');
  assert.equal(index.at(source.text.length),undefined);
  for(const offset of [-1,NaN,Infinity,0.5,source.text.length+1]) assert.throws(()=>index.at(offset),RangeError);
  assert.ok(Object.isFrozen(index));
  assert.ok(Object.isFrozen(index.symbols));
  assert.throws(()=>index.get('numeric:alpha').occurrences.push({}),TypeError);
  session.update({source:new SourceDocument(source.id,'10 LET beta=2'),version:1});
  assert.equal(documentSymbolIndex(session.current).value.get('numeric:alpha'),undefined);
  assert.equal(index.get('numeric:beta'),undefined);
  assert.equal(index.get('numeric:alpha').occurrences.length,2);
});
test('duplicate FN/formal declarations retain all locations and original first-match binding', () => {
  const {index,session}=analyze('10 DEF FN f(x,x)=x\n20 DEF FN f(x)=x\n30 PRINT FN f(1,2)\n');
  assert.equal(session.current.analysis.kind,'buildable');
  const fn=index.get('function:f');
  assert.deepEqual(roles(fn),['definition','definition','read']);
  assert.deepEqual(fn.occurrences[2].definitionRange,fn.occurrences[0].range);
  const duplicate=index.symbols.find(s=>s.identity?.family==='formal' && s.occurrences.length===3);
  assert.deepEqual(roles(duplicate),['definition','definition','read']);
  assert.deepEqual(duplicate.occurrences[2].definitionRange,duplicate.occurrences[0].range);
});
