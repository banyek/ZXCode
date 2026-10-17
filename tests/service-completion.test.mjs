import test from 'node:test';
import assert from 'node:assert/strict';
import {createDocumentSession,SourceDocument,documentCompletions} from '@zxcode/core';
const globals='100 LET n=1: LET s$="x"\n200 STOP\n';
function query(marked, options) {
  const offset=marked.indexOf('|');
  assert.ok(offset>=0);
  const source=new SourceDocument('completion.bas',marked.slice(0,offset)+marked.slice(offset+1));
  const snapshot=createDocumentSession({source,version:1},options).current;
  return {source,snapshot,result:documentCompletions(snapshot,offset),offset};
}
const labels=result=>result.value.items.map(i=>i.label);
test('statement starts, prefixes, separators and IF tails offer authentic available commands',()=>{
  for(const text of ['10 |','10 PR|','10 CLS: |','10 IF 1 THEN |','10 IF 1 THEN CLS: |']) {
    const {result}=query(text);
    assert.equal(result.value.context.kind,'statement-start');
    assert.ok(labels(result).includes('PRINT'));
    assert.ok(!labels(result).includes('CAT'));
    assert.ok(!labels(result).includes('SIN'));
    assert.ok(!labels(result).includes('WHILE'));
  }
  assert.deepEqual(labels(query('10 PR|').result),['PRINT']);
  assert.ok(labels(query('10 |',{targetProfile:{id:'if1',capabilities:['interface1']}}).result).includes('CAT'));
  assert.deepEqual(labels(query('10 GO |').result),['SUB','TO']);
});
test('PRINT items and numeric/string operand contexts filter candidates rather than dump keywords',()=>{
  const print=query(globals+'10 PRINT |').result;
  for(const label of ['AT','TAB','INK','CHR$','SIN','n','s$']) assert.ok(labels(print).includes(label),label);
  assert.ok(!labels(print).includes('LET'));
  for(const text of ['10 PRINT AT 10,|','10 BORDER |','10 LET a=|','10 PRINT STR$ |']) {
    const {result}=query(globals+text);
    assert.equal(result.value.context.expectedType,'numeric',text);
    assert.ok(labels(result).includes('n'),text);
    assert.ok(!labels(result).includes('s$'),text);
    assert.ok(!labels(result).includes('CHR$'),text);
  }
  for(const text of ['10 LET a$=|','10 ERASE |','10 PRINT VAL |']) {
    const {result}=query(globals+text);
    assert.equal(result.value.context.expectedType,'string',text);
    assert.ok(labels(result).includes('s$'),text);
    assert.ok(labels(result).includes('CHR$'),text);
    assert.ok(!labels(result).includes('n'),text);
    assert.ok(!labels(result).includes('SIN'),text);
    assert.ok(!labels(result).includes('AT'),text);
  }
});
test('FOR and IF continuations follow consumed parser delimiters and expression completeness',()=>{
  for(const [source,yes,no] of [
    ['10 FOR i=1 |','TO','STEP'], ['10 FOR i=1 TO 10 |','STEP','TO'],
    ['10 FOR i=1 TO 10 ST|','STEP','TO'], ['10 IF n |','THEN','STEP']
  ]) {
    const names=labels(query(globals+source).result);
    assert.ok(names.includes(yes),source);
    assert.ok(!names.includes(no),source);
  }
  for(const source of ['10 IF n+|','10 FOR i=1 TO |','10 FOR i=1 TO 10 STEP |']) {
    const {result}=query(globals+source);
    assert.equal(result.value.context.expectedType,'numeric');
    assert.ok(!labels(result).includes('THEN'));
    assert.ok(!labels(result).includes('STEP'));
  }
});
test('GO TO/GO SUB rank real line numbers and do not synthesize labels or numbering',()=>{
  for(const command of ['GO TO','GO SUB']) {
    const {result}=query(globals+`10 ${command} |`);
    assert.deepEqual(result.value.items.slice(0,3).map(i=>i.label),['10','100','200']);
    assert.ok(result.value.items.slice(0,3).every(i=>i.kind==='line-number'));
    assert.equal(result.value.context.expectedType,'numeric');
  }
  for(const source of ['|','PRINT |','10 PRINT "GO TO |','10 REM GO TO |']) assert.deepEqual(labels(query(source).result),[]);
});
test('completion edits replace the original word and keep checked snapshot/version identity',()=>{
  const {result,source,snapshot,offset}=query('10 PR|INT 1');
  const item=result.value.items.find(i=>i.label==='PRINT');
  assert.equal(source.textInRange(item.edit.range),'PRINT');
  assert.equal(source.text.slice(0,item.edit.range.start)+item.edit.newText+source.text.slice(item.edit.range.end),'10 PRINT 1');
  assert.strictEqual(result.snapshot,snapshot.identity);
  assert.strictEqual(documentCompletions(snapshot,offset),result);
  assert.ok(Object.isFrozen(result.value.items));
  assert.ok(Object.isFrozen(item.edit));
  for(const bad of [-1,0.5,NaN,source.text.length+1]) assert.throws(()=>documentCompletions(snapshot,bad),RangeError);
});
test('FN return/argument types and local formals use shared semantic scope',()=>{
  const definitions='10 DEF FN f(x)=x\n20 DEF FN g$(s$)=s$\n';
  assert.ok(labels(query(definitions+'30 LET a$=|').result).includes('FN g$'));
  assert.ok(!labels(query(definitions+'30 LET a$=|').result).includes('FN f'));
  const name=query(definitions+'30 PRINT FN g|').result.value.items.find(i=>i.label==='FN g$');
  assert.equal(name.edit.newText,'g$(');
  const arg=query(definitions+globals+'30 PRINT FN g$(|').result;
  assert.equal(arg.value.context.expectedType,'string');
  assert.ok(labels(arg).includes('s$'));
  assert.ok(!labels(arg).includes('n'));
  const local=query('10 LET outside=1\n20 DEF FN f(x)=|').result;
  assert.ok(labels(local).includes('x'));
  const external=query('10 DEF FN f(x)=x\n20 PRINT |').result;
  assert.ok(!labels(external).includes('x'));
});
