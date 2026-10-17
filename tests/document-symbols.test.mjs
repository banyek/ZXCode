import test from 'node:test';
import assert from 'node:assert/strict';
import {createDocumentSession,SourceDocument,documentSymbols} from '@zxcode/core';
const session=text=>createDocumentSession({source:new SourceDocument('outline.bas',text),version:1});
function checkRanges(source,symbols,parent=source.range(0,source.text.length)) {
  for(const symbol of symbols) {
    assert.equal(symbol.range.sourceId,source.id);
    assert.ok(parent.start<=symbol.range.start && symbol.range.end<=parent.end);
    assert.ok(symbol.range.start<=symbol.selectionRange.start && symbol.selectionRange.end<=symbol.range.end);
    assert.doesNotThrow(()=>source.textInRange(symbol.selectionRange));
    assert.ok(Object.isFrozen(symbol));
    if(symbol.children) {assert.ok(Object.isFrozen(symbol.children));checkRanges(source,symbol.children,symbol.range);}
  }
}
test('outline uses physical line order and meaningful write/definition structures',()=>{
  const document=session('100 LET total=0\n0010 DIM a(3): LET a(1)=total\n50 FOR i=1 TO 3: NEXT i\n20 INPUT total: READ a(1)\n');
  const result=documentSymbols(document.current);
  assert.deepEqual(result.value.map(s=>s.name),['100','0010','50','20']);
  assert.deepEqual(result.value.map(s=>s.children.map(c=>c.name)),[['total'],['a','a'],['i'],['total','a']]);
  assert.deepEqual(result.value[1].children.map(c=>c.kind),['array','array']);
  assert.equal(result.value[1].key,'line:10');
  assert.strictEqual(result.snapshot,document.current.identity);
  assert.strictEqual(documentSymbols(document.current),result);
  checkRanges(document.current.source,result.value);
});
test('DEF FN has actual formal children including duplicates and nested IF definitions',()=>{
  const document=session('10 DEF FN f(x,x)=x\n20 IF 1 THEN DEF FN g$(s$)=s$\n30 PRINT FN f(1,2)\n');
  const symbols=documentSymbols(document.current).value;
  assert.equal(symbols[0].children[0].kind,'function');
  assert.deepEqual(symbols[0].children[0].children.map(s=>[s.name,s.kind,s.detail]),[['x','parameter','numeric'],['x','parameter','numeric']]);
  assert.equal(symbols[1].children[0].name,'g$');
  assert.deepEqual(symbols[1].children[0].children.map(s=>s.name),['s$']);
  assert.deepEqual(symbols[2].children,[]);
  checkRanges(document.current.source,symbols);
});
test('malformed documents keep valid numbered/duplicate lines without guessed header symbols',()=>{
  const document=session('20 PRINT AT 1,\r\n10 LET a=1\r\n10 REM 😀\r\nPRINT phantom\r\n10000 STOP\r\n30\r\n');
  assert.equal(document.current.analysis.kind,'invalid');
  const symbols=documentSymbols(document.current).value;
  assert.deepEqual(symbols.map(s=>s.name),['20','10','10','30']);
  assert.deepEqual(symbols.map(s=>s.children.map(c=>c.name)),[[],['a'],[],[]]);
  checkRanges(document.current.source,symbols);
});
test('old cached outlines remain immutable after document replacement',()=>{
  const document=session('10 LET old=1\n');
  const old=document.current;
  const before=documentSymbols(old);
  document.update({source:new SourceDocument(old.source.id,'20 LET current=2\n'),version:2});
  const after=documentSymbols(document.current);
  assert.equal(before.value[0].children[0].name,'old');
  assert.equal(after.value[0].children[0].name,'current');
  assert.notStrictEqual(before.snapshot,after.snapshot);
  assert.strictEqual(documentSymbols(old),before);
  assert.throws(()=>before.value.push({}),TypeError);
  assert.deepEqual(documentSymbols(session('').current).value,[]);
});
