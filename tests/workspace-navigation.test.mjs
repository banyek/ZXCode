import test from 'node:test';
import assert from 'node:assert/strict';
import { SourceDocument,createDocumentSession,workspaceSymbols,languageService } from '../packages/core/dist/index.js';
const snapshot=(id,text,version=1)=>createDocumentSession({source:new SourceDocument(id,text),version}).current;
test('workspace discovery keeps same-named symbols qualified by exact document identity',()=>{
 const a=snapshot('a.zxbas','10 LET count=1\n20 GO TO 99\n'),b=snapshot('b.zxbas','10 LET count=2\n99 STOP\n');
 const result=workspaceSymbols([b,a],'CoUnT');assert.equal(result.value.length,2);
 assert.strictEqual(result.value[0].document,a.identity);assert.strictEqual(result.value[1].document,b.identity);
 assert.equal(languageService.definitions(a,a.source.text.indexOf('99')).value.length,0);
 assert.ok(languageService.diagnostics(a).value.some(d=>d.code==='ZX3001'));
 assert.deepEqual(workspaceSymbols([a,b],'missing').value,[]);assert.ok(Object.isFrozen(result.value));
});
test('workspace outline search includes lines/functions but omits formal parameters and rejects duplicate document versions',()=>{
 const a=snapshot('a','10 DEF FN f(x)=x+1\n20 PRINT FN f(1)\n');
 const result=workspaceSymbols([a]);assert.ok(result.value.some(item=>item.symbol.kind==='function'));assert.ok(result.value.some(item=>item.symbol.kind==='line'));
 assert.ok(result.value.every(item=>item.symbol.kind!=='parameter'));
 assert.throws(()=>workspaceSymbols([a,snapshot('a','10 STOP\n',2)]));
 assert.deepEqual(workspaceSymbols([]).value,[]);
});
