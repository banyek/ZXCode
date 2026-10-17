import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import tm from 'vscode-textmate';
import onig from 'vscode-oniguruma';
import {createTextMateGrammar} from '../scripts/extension/grammar.mjs';
const path=new URL('../packages/extension/syntaxes/zx-spectrum-basic.tmLanguage.json',import.meta.url);
const bytes=readFileSync(new URL('../node_modules/vscode-oniguruma/release/onig.wasm',import.meta.url));
await onig.loadWASM(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
const registry=new tm.Registry({onigLib:Promise.resolve({createOnigScanner:p=>new onig.OnigScanner(p),createOnigString:s=>new onig.OnigString(s)}),loadGrammar:async()=>tm.parseRawGrammar(readFileSync(path,'utf8'),'spectrum.json')});
const grammar=await registry.loadGrammar('source.zx-spectrum-basic');
const tokens=(line,state)=>grammar.tokenizeLine(line,state);
const at=(line,needle,result=tokens(line))=>result.tokens.find(t=>t.startIndex<=line.indexOf(needle) && line.indexOf(needle)<t.endIndex).scopes;
const has=(scopes,prefix)=>scopes.some(s=>s.startsWith(prefix));
test('generated visual vocabulary is pinned without claiming generic .bas or a parser role',()=>{
  assert.deepEqual(JSON.parse(readFileSync(path)),createTextMateGrammar());
  const manifest=JSON.parse(readFileSync(new URL('../packages/extension/package.json',import.meta.url)));
  assert.deepEqual(manifest.contributes.languages[0].extensions,['.zxbas']);
  assert.equal(manifest.contributes.languages[0].id,'zx-spectrum-basic');
  assert.equal(manifest.contributes.grammars[0].scopeName,'source.zx-spectrum-basic');
  const config=JSON.parse(readFileSync(new URL('../packages/extension/language-configuration.json',import.meta.url)));
  assert.equal(config.comments,undefined);
});
test('line numbers, canonical words, dollar functions, stream keywords and numeric surface have native scopes',()=>{
  for(const [line,word,scope] of [
    ['0010 GO TO 20','0010','constant.numeric.line-number'],
    ['10 GO SUB 20','GO SUB','keyword.control.statement'],
    ['10 DEF FN f(x)=x','DEF FN','keyword.control.statement'],
    ['10 OPEN#4,"s"','OPEN#','keyword.control.statement'],
    ['10 CLOSE #4','CLOSE #','keyword.control.statement'],
    ['10 PRINT CHR$(65)','CHR$','support.function'],
    ['10 PRINT RND;PI','RND','constant.language'],
    ['10 FOR i=1 TO 2 STEP .5','STEP','keyword.control'],
    ['10 PRINT . 5;1. 2 E + 3;1E-2','1. 2 E + 3','constant.numeric']
  ]) assert.ok(has(at(line,word),scope),`${line}: ${word}`);
});
test('REM begins only in statement context and protects the rest of its physical line',()=>{
  for(const line of ['10 REM PRINT: STOP','10 CLS: REM PRINT: STOP','10 IF 1 THEN REM PRINT: STOP']) {
    assert.ok(has(at(line,'STOP'),'comment.line.rem'));
    assert.ok(!has(at(line,'STOP'),'keyword.control.statement'));
  }
  const variable='10 LET rem=1: PRINT rem';
  assert.ok(!has(at(variable,'rem'),'comment'));
  const longer='10 LET REMARK=1: PRINT THENVALUE';
  assert.ok(!has(at(longer,'REMARK'),'comment'));
  assert.ok(!has(at(longer,'THENVALUE'),'keyword.control'));
});
test('strings and doubled quotes suppress keyword scopes, escapes stay visual, recovery ends at newline',()=>{
  const line='10 PRINT "REM ""THEN"" {UDG A} {{text}}";SIN 1';
  for(const word of ['REM','THEN']) {
    assert.ok(has(at(line,word),'string.quoted'));
    assert.ok(!has(at(line,word),'keyword.control'));
  }
  assert.ok(has(at(line,'""'),'constant.character.escape.quote'));
  assert.ok(has(at(line,'{UDG A}'),'constant.character.escape'));
  assert.ok(has(at(line,'SIN'),'support.function'));
  const broken=tokens('10 PRINT "unfinished');
  const next=tokens('20 PRINT 1',broken.ruleStack);
  assert.ok(has(at('20 PRINT 1','PRINT',next),'keyword.control.statement'));
  assert.ok(!has(at('20 PRINT 1','PRINT',next),'string.quoted'));
});
