import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {LANGUAGE_HELP,languageHelp,ROM_TOKENS,BUILTIN_SIGNATURES,createDocumentSession,SourceDocument,documentHover,documentCompletions,documentSignatureHelp} from '@zxcode/core';
const snapshot=text=>createDocumentSession({source:new SourceDocument('help.bas',text),version:0}).current;
function marked(text) {
  const offset=text.indexOf('|');
  return {offset,snapshot:snapshot(text.slice(0,offset)+text.slice(offset+1))};
}
test('help covers every independently catalogued ROM token with immutable provenance and no aliases',()=>{
  const fixture=JSON.parse(readFileSync(new URL('./fixtures/rom-tokens.json',import.meta.url)));
  const expected=fixture;
  assert.equal(LANGUAGE_HELP.length,91);
  assert.deepEqual(LANGUAGE_HELP.map(h=>({byte:h.token.byte,spelling:h.token.spelling})),expected.map(t=>({byte:t.byte,spelling:t.spelling})));
  for(const entry of LANGUAGE_HELP) {
    assert.strictEqual(entry.token,ROM_TOKENS.find(t=>t.byte===entry.token.byte));
    assert.ok(entry.summary.length>0);
    assert.ok(entry.syntax.every(s=>s.length>0));
    assert.ok(entry.links.every(l=>l.url.startsWith('https://worldofspectrum.org/ZXBasicManual/')));
    assert.ok(Object.isFrozen(entry));
    assert.ok(Object.isFrozen(entry.syntax));
    assert.strictEqual(languageHelp(entry.token.spelling.toLowerCase()),entry);
  }
  assert.equal(languageHelp('GOTO'),undefined);
  assert.equal(languageHelp('WHILE'),undefined);
});
test('built-in help shares exact arity/result facts with the semantic signature table',()=>{
  assert.equal(BUILTIN_SIGNATURES.length,27);
  for(const signature of BUILTIN_SIGNATURES) {
    const help=languageHelp(signature.token.spelling);
    assert.deepEqual(help.parameters.map(p=>p.type),signature.arguments);
    assert.equal(help.resultType,signature.result);
  }
  assert.match(languageHelp('FN').summary,/parentheses.*no arguments/);
  for(const name of ['CAT','FORMAT','MOVE','ERASE']) assert.ok(languageHelp(name).remarks.some(r=>r.includes('Interface 1')));
  assert.equal(languageHelp('OPEN #').remarks,undefined);
});
test('completion and token hover consume the same structured documentation including multiword commands',()=>{
  for(const text of ['10 PR|','10 PRINT SI|']) {
    const {snapshot:s,offset}=marked(text);
    const item=documentCompletions(s,offset).value.items[0];
    assert.equal(item.documentation.summary,languageHelp(item.label).summary);
  }
  for(const [text,name] of [['10 GO |TO 100','GO TO'],['10 DEF |FN f(x)=x','DEF FN'],['10 OPEN |#4,"s"','OPEN #'],['10 PRINT SI|N 1','SIN'],['10 PR|INT 1','PRINT']]) {
    const {snapshot:s,offset}=marked(text);
    const hover=documentHover(s,offset);
    assert.equal(hover.value.documentation.summary,languageHelp(name).summary,text);
    assert.deepEqual(hover.value.documentation.syntax,languageHelp(name).syntax);
    assert.strictEqual(hover.snapshot,s.identity);
  }
  const variable=marked('10 LET P|I=1');
  assert.match(documentHover(variable.snapshot,variable.offset).value.documentation.summary,/numeric variable/);
  for(const text of ['10 PRINT "SI|N"','10 REM SI|N']) {
    const {snapshot:s,offset}=marked(text);
    assert.equal(documentHover(s,offset).value,undefined);
  }
});
test('signature help uses shared built-in and first-bound user-function parameters at incomplete cursors',()=>{
  for(const [text,active,types] of [
    ['10 PRINT SIN |',0,['numeric']], ['10 PRINT VAL |',0,['string']],
    ['10 PRINT ATTR(1,|',1,['numeric','numeric']],
    ['10 PRINT USR |',0,['numeric-or-string']]
  ]) {
    const {snapshot:s,offset}=marked(text);
    const result=documentSignatureHelp(s,offset);
    assert.equal(result.value.activeParameter,active,text);
    assert.deepEqual(result.value.signatures[0].parameters.map(p=>p.label.split(': ')[1]),types);
    assert.strictEqual(result.snapshot,s.identity);
    assert.ok(Object.isFrozen(result.value.signatures));
  }
  const {snapshot:s,offset}=marked('10 DEF FN f(x,s$)=x\n20 DEF FN f(q)=q\n30 PRINT FN f(1,|');
  const result=documentSignatureHelp(s,offset);
  assert.equal(result.value.activeParameter,1);
  assert.deepEqual(result.value.signatures[0].parameters.map(p=>p.label),['x: numeric','s$: string']);
  for(const text of ['10 PRINT FN z(|','10 PRINT "SIN |','10 REM SIN |','10 |']) {
    const {snapshot:s,offset}=marked(text);
    assert.equal(documentSignatureHelp(s,offset).value,undefined);
  }
  assert.throws(()=>documentSignatureHelp(s,-1),RangeError);
});
