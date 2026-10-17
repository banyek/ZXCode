import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createDocumentSession,SourceDocument,documentDiagnostics,documentCompletions,documentDefinitions,documentReferences,documentHover,documentSignatureHelp,documentSymbols} from '@zxcode/core';
const fixture=JSON.parse(readFileSync(new URL('./fixtures/service-incomplete.json',import.meta.url)));
function serialize(snapshot,offset) {
  const source=snapshot.source;
  const range=r=>[r.start,r.end,source.textInRange(r)];
  const queries=[documentDiagnostics(snapshot),documentCompletions(snapshot,offset),documentDefinitions(snapshot,offset),documentReferences(snapshot,offset),documentHover(snapshot,offset),documentSignatureHelp(snapshot,offset),documentSymbols(snapshot)];
  for(const result of queries) assert.strictEqual(result.snapshot,snapshot.identity);
  const [diagnostics,completion,definitions,references,hover,signature,symbols]=queries;
  const h=hover.value,s=signature.value;
  for(const item of completion.value.items) {
    assert.equal(item.edit.range.sourceId,source.id);
    assert.ok(item.edit.range.start>=0 && item.edit.range.end<=source.text.length);
  }
  return {
    diagnostics:diagnostics.value.map(d=>[d.code,d.severity,d.category,...range(d.range)]),
    completion:{context:completion.value.context,labels:completion.value.items.map(i=>i.label)},
    definitions:definitions.value.map(range),references:references.value.map(range),
    hover:h?[h.range.start,h.range.end,h.documentation.summary]:null,
    signature:s?{label:s.signatures[0].label,activeParameter:s.activeParameter,parameters:s.signatures[0].parameters.map(p=>p.label)}:null,
    outline:symbols.value.map(s=>s.name)
  };
}
test('nineteen reviewed cursor fixtures pin incomplete diagnostics, contextual candidates and navigation',()=>{
  assert.equal(fixture.cases.length,19);
  for(const item of fixture.cases) {
    const offset=item.markedSource.indexOf('|');
    assert.equal(item.markedSource.indexOf('|',offset+1),-1);
    const source=new SourceDocument('fixture.bas',item.markedSource.replace('|',''));
    const session=createDocumentSession({source,version:item.version});
    const old=session.current;
    const actual=serialize(old,offset),expected=item.expected;
    for(const key of ['diagnostics','definitions','references','hover','signature','outline']) assert.deepEqual(actual[key],expected[key],`${item.name}: ${key}`);
    assert.deepEqual(actual.completion.context,expected.completion.context,item.name);
    for(const label of expected.completion.include) assert.ok(actual.completion.labels.includes(label),`${item.name}: include ${label}`);
    for(const label of expected.completion.exclude) assert.ok(!actual.completion.labels.includes(label),`${item.name}: exclude ${label}`);
    if(expected.completion.exact) assert.deepEqual(actual.completion.labels,expected.completion.exact,item.name);
    if(expected.completion.first) assert.deepEqual(actual.completion.labels.slice(0,expected.completion.first.length),expected.completion.first,item.name);
    assert.deepEqual(serialize(old,offset),actual,item.name);
    session.update({source:new SourceDocument(source.id,'10 STOP\n'),version:item.version+1});
    assert.deepEqual(serialize(old,offset),actual,`${item.name}: old snapshot after update`);
    assert.notStrictEqual(session.current.identity,old.identity);
  }
});
