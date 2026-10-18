import test from 'node:test';
import assert from 'node:assert/strict';
import { SourceDocument, createDocumentSession, formatDocument, checkProgram } from '../packages/core/dist/index.js';
const format = text => formatDocument(createDocumentSession({source:new SourceDocument('format.zxbas',text),version:1}).current).value;
test('formatter preserves binary bytes, physical order, mixed endings and opaque source',()=>{
 const input=' \t0020\tprint   "£©↑ {{GO TO}}"  :  REM  keep   GO TO 10   \r\n\t10  LET  letter=1: print  letter  \r \t\n30 STOP';
 const result=format(input);
 assert.equal(result.kind,'formatted');
 assert.equal(result.resultText,'0020 print "£©↑ {{GO TO}}" : REM  keep   GO TO 10   \r\n10 LET letter=1: print letter\r\n30 STOP');
 assert.deepEqual(checkProgram(new SourceDocument('a',input)).encodedProgram.programBytes,checkProgram(new SourceDocument('b',result.resultText)).encodedProgram.programBytes);
 assert.deepEqual(format(result.resultText).edits,[]);
 assert.ok(Object.isFrozen(result.edits));
});
test('formatter copies numeric spelling, raw escapes and string quotes without canonical export',()=>{
 for(const input of ['10  PRINT  . 5  :  PRINT "a""b {INK 2}"\n','10  REM {BYTE 0x0D}  \n','10  PRINT  1E + 2\n','10 LET  letter=1: PRINT  letter\n']) {
   const result=format(input);assert.equal(result.kind,'formatted',input);
   assert.equal(format(result.resultText).resultText,result.resultText);
   assert.deepEqual(format(result.resultText).edits,[]);
 }
});
test('formatter refuses incomplete and incompatible programs without partial edits',()=>{
 for(const input of ['10 PRINT "unfinished\n','PRINT 1\n','10 STOP\n10 STOP\n']) {
   const result=format(input);assert.equal(result.kind,'blocked');assert.equal(result.reason,'invalid-program');assert.equal(result.edits,undefined);
 }
});
