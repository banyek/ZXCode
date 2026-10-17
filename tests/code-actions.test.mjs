import test from 'node:test';
import assert from 'node:assert/strict';
import { SourceDocument, createDocumentSession, documentCodeActions, languageService } from '../packages/core/dist/index.js';
const snapshot = text => createDocumentSession({source:new SourceDocument('fix.zxbas',text),version:1}).current;
test('shared code actions use stable diagnostic codes and preserve all unrelated source',()=>{
 const original=snapshot(' \t0010PRINT "£©↑"\r\n20 REM keep  \n');
 const result=languageService.codeActions(original);
 assert.strictEqual(result.snapshot,original.identity);
 assert.equal(result.value.length,1);
 const action=result.value[0];assert.equal(action.id,'zxcode.insert-line-separator');
 assert.equal(action.diagnostics[0].code,'ZX1002');
 assert.equal(action.resultText,' \t0010 PRINT "£©↑"\r\n20 REM keep  \n');
 assert.equal(action.edits[0].range.start,6);assert.equal(action.edits[0].newText,' ');
 assert.ok(Object.isFrozen(action.edits));assert.equal(original.source.text,' \t0010PRINT "£©↑"\r\n20 REM keep  \n');
});
test('multiple missing separators form one independently validated atomic action',()=>{
 const original=snapshot('10PRINT 1\n20REM  keep : PRINT 3  \n');
 const [action]=documentCodeActions(original).value;
 assert.equal(action.id,'zxcode.insert-line-separators');assert.equal(action.edits.length,2);
 assert.equal(action.resultText,'10 PRINT 1\n20 REM  keep : PRINT 3  \n');
 assert.deepEqual(documentCodeActions(snapshot(action.resultText)).value,[]);
});
test('ambiguous or still-invalid programs receive no guessed fixes',()=>{
 for(const text of ['PRINT 1\n','0PRINT 1\n','10000PRINT 1\n','10LET\n','10e1 PRINT 1\n','10PRINT 1\n10 STOP\n','10 PRINT "unfinished\n','10 GO TO 99\n']) assert.deepEqual(documentCodeActions(snapshot(text)).value,[],text);
});
test('code action ranges filter results and reject foreign document identities',()=>{
 const original=snapshot('10PRINT 1\n20 STOP\n');
 assert.deepEqual(documentCodeActions(original,original.source.range(12,14)).value,[]);
 assert.equal(documentCodeActions(original,original.source.range(0,0)).value.length,1);
 assert.throws(()=>documentCodeActions(original,new SourceDocument('other','x').range(0,1)));
});
