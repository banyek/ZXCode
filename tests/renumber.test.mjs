import test from 'node:test';
import assert from 'node:assert/strict';
import { SourceDocument, createDocumentSession, previewRenumber, applyRenumber } from '../packages/core/dist/index.js';
const snapshot = text => createDocumentSession({source:new SourceDocument('renumber.zxbas',text),version:1}).current;
const preview = (text,options={start:100,step:10}) => previewRenumber(snapshot(text),options).value;
test('renumber preserves nested control-flow chains and unrelated literals byte for byte',()=>{
 const text='0010 LET x=20: IF x THEN GO SUB (30): GO TO 20\r\n20 PRINT "GO TO 30";20: REM GO TO 30\r\n30 DATA 20,30\r\n40 RESTORE 30: RUN 10: LIST #2;20: LLIST 30\r\n50 SAVE "x" LINE 10\r\n60 RETURN\r\n';
 const result=preview(text);
 assert.equal(result.kind,'preview');
 assert.equal(result.resultText,'100 LET x=20: IF x THEN GO SUB 120: GO TO 110\r\n110 PRINT "GO TO 30";20: REM GO TO 30\r\n120 DATA 20,30\r\n130 RESTORE 120: RUN 100: LIST #2;110: LLIST 120\r\n140 SAVE "x" LINE 100\r\n150 RETURN\r\n');
 assert.equal(result.references.length,7);
 assert.ok(Object.isFrozen(result.edits));
});
test('gap targets retain the original lower-bound line, zero and end destinations',()=>{
 const result=preview('10 GO TO 15\n20 GO SUB 19: RESTORE 0: RUN 99\n');
 assert.equal(result.kind,'preview');
 assert.equal(result.resultText,'100 GO TO 110\n110 GO SUB 110: RESTORE 0: RUN 111\n');
 assert.deepEqual(result.references.map(r=>r.resolution),['following','following','start','end']);
 assert.equal(preview('10 GO TO 15\n20 STOP\n',{start:1,step:19}).resultText,'1 GO TO 15\n20 STOP\n');
 assert.equal(preview('10 GO TO 99\n20 STOP\n',{start:9998,step:1}).issues[0].code,'end-target-captured');
});
test('unsafe references, invalid programs, collisions and order crossings expose no partial edits',()=>{
 for(const [text,options,code] of [
 ['10 GO TO x\n20 STOP\n',{},'unproven-reference'],
 ['10 GO TO 10+0\n20 STOP\n',{},'unproven-reference'],
 ['10 GO TO 1.5\n20 STOP\n',{},'unsupported-reference'],
 ['10 STOP\n10 STOP\n',{},'invalid-program'],
 ['10 STOP\n20 STOP\n30 STOP\n',{fromLine:20,throughLine:20,start:30},'collision'],
 ['10 STOP\n20 STOP\n30 STOP\n',{fromLine:20,throughLine:20,start:40},'order-change'],
 ['10 STOP\n20 STOP\n',{start:9999,step:1},'invalid-options'],
 ]) {
   const result=preview(text,{start:100,step:10,...options});
   assert.equal(result.kind,'blocked');assert.equal(result.issues[0].code,code);assert.equal(result.edits,undefined);
 }
});
test('selection uses stored order while physical order and unchanged spelling survive',()=>{
 const result=preview('0030 STOP\n0010 GO TO BIN 11110\n20 STOP\n',{fromLine:20,start:21,step:10});
 assert.equal(result.kind,'preview');assert.equal(result.resultText,'31 STOP\n0010 GO TO 31\n21 STOP\n');
 const noop=preview('10 GO TO x\n20 STOP\n',{start:10,step:10});
 assert.equal(noop.kind,'preview');assert.deepEqual(noop.edits,[]);
 assert.equal(preview('10 STOP\n',{fromLine:20,throughLine:30}).resultText,'10 STOP\n');
});
test('apply binds to exact snapshot identity, rejecting edits and reopen with identical source',()=>{
 const original=snapshot('10 GO TO 10\n');const result=previewRenumber(original,{start:100});
 assert.equal(applyRenumber(result,original).text,'100 GO TO 100\n');
 assert.equal(applyRenumber(result,snapshot(original.source.text)).issues[0].code,'stale-preview');
});
