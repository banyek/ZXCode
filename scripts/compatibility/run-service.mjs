import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {SourceDocument,SourceRange,createDocumentSession,languageService} from '../../packages/core/dist/index.js';
const fixtures=new URL('../../tests/fixtures/',import.meta.url);
function checkValue(source,value) {
  const pending=[value];
  while(pending.length) {
    const node=pending.pop();
    if(node===null || typeof node!=='object') continue;
    assert.ok(Object.isFrozen(node),'Query values must be immutable');
    if(node instanceof SourceRange) {
      assert.equal(node.sourceId,source.id);
      assert.ok(node.start>=0 && node.start<=node.end && node.end<=source.text.length);
      assert.equal(source.offsetAt(source.positionAt(node.start)),node.start);
      assert.equal(source.offsetAt(source.positionAt(node.end)),node.end);
      assert.equal(source.textInRange(node),source.text.slice(node.start,node.end));
    } else {
      for(const [key,child] of Object.entries(node)) {
        if(key==='range' || key==='selectionRange' || key==='definitionRange') assert.ok(child instanceof SourceRange,'Expected checked core source range');
        pending.push(child);
      }
    }
  }
}
function checkOutline(symbols,parent) {
  for(const symbol of symbols) {
    assert.ok(parent.start<=symbol.range.start && symbol.range.end<=parent.end);
    assert.ok(symbol.range.start<=symbol.selectionRange.start && symbol.selectionRange.end<=symbol.range.end);
    checkOutline(symbol.children??[],symbol.range);
  }
}
export function runHeadlessAcceptance() {
  const core=JSON.parse(readFileSync(new URL('core-corpus.json',fixtures)));
  const incomplete=JSON.parse(readFileSync(new URL('service-incomplete.json',fixtures)));
  const cases=[...core.cases.map(c=>({name:`core/${c.name}`,source:c.source})),...incomplete.cases.map(c=>({name:`incomplete/${c.name}`,source:c.markedSource.replace('|','')}))];
  const documents=[];
  for(const item of cases) {
    const source=new SourceDocument(`${item.name}.bas`,item.source);
    const snapshot=createDocumentSession({source,version:1}).current;
    const hash=createHash('sha256');
    let queries=0;
    const record=(method,result,offset)=>{
      assert.strictEqual(result.snapshot,snapshot.identity);
      assert.ok(Object.isFrozen(result));
      checkValue(source,result.value);
      if(method==='definitions' || method.startsWith('references')) assert.ok(result.value.every(range=>range instanceof SourceRange));
      const bytes=Buffer.from(JSON.stringify({method,offset,value:result.value}));
      const length=Buffer.alloc(4);length.writeUInt32LE(bytes.length);
      hash.update(length);hash.update(bytes);queries++;
    };
    record('diagnostics',languageService.diagnostics(snapshot));
    const symbols=languageService.symbols(snapshot);
    checkOutline(symbols.value,source.range(0,source.text.length));
    record('symbols',symbols);
    for(let offset=0;offset<=source.text.length;offset++) {
      record('completions',languageService.completions(snapshot,offset),offset);
      record('hover',languageService.hover(snapshot,offset),offset);
      record('definitions',languageService.definitions(snapshot,offset),offset);
      record('references',languageService.references(snapshot,offset),offset);
      record('references-with-declarations',languageService.references(snapshot,offset,{includeDeclaration:true}),offset);
      record('signatureHelp',languageService.signatureHelp(snapshot,offset),offset);
    }
    for(const method of ['completions','hover','definitions','references','signatureHelp']) for(const offset of [-1,NaN,source.text.length+1]) assert.throws(()=>languageService[method](snapshot,offset),RangeError);
    documents.push({name:item.name,sourceSha256:createHash('sha256').update(source.text).digest('hex'),positions:source.text.length+1,queries,querySha256:hash.digest('hex')});
  }
  return {version:1,documents,totalPositions:documents.reduce((sum,d)=>sum+d.positions,0),totalQueries:documents.reduce((sum,d)=>sum+d.queries,0)};
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  const args=process.argv.slice(2);
  assert.ok(args.length===0 || args.length===2 && args[0]==='--report','Usage: run-service.mjs [--report path]');
  const report=JSON.stringify(runHeadlessAcceptance(),null,2)+'\n';
  if(args.length) {mkdirSync(dirname(args[1]),{recursive:true});writeFileSync(args[1],report,'utf8');}
  process.stdout.write(report);
}
