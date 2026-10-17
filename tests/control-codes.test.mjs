import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { analyzeSpectrumText, decodeSpectrumText, encodeSpectrumText } from '@zxcode/core';
const fixture = JSON.parse(readFileSync(new URL('./fixtures/controls-rom.json', import.meta.url), 'utf8'));
function encoded(atoms) { const result = analyzeSpectrumText(atoms); assert.equal(result.kind, 'success'); return encodeSpectrumText(result.value); }
test('all control families and parameter bytes match original-ROM packet fixtures', () => {
  for (const entry of fixture.cases) {
    assert.equal(Buffer.from(encoded(entry.atoms)).toString('hex'), entry.bytesHex, entry.name);
    const decoded = decodeSpectrumText(Uint8Array.from(Buffer.from(entry.bytesHex,'hex')));
    assert.deepEqual(decoded.issues, [], entry.name);
    assert.deepEqual(decoded.atoms, entry.atoms, entry.name);
    assert.equal(Buffer.from(encoded(decoded.atoms)).toString('hex'), entry.bytesHex, entry.name);
  }
});
test('packet parameters do not become nested controls, quote syntax or tokens', () => {
  for (const parameters of [[13,16],[34,58],[165,255]]) {
    const decoded = decodeSpectrumText(Uint8Array.from([22,...parameters]));
    assert.equal(decoded.atoms.length, 1);
    assert.deepEqual(decoded.atoms[0], { kind:'control', name:'AT', parameters });
    assert.deepEqual(encoded(decoded.atoms), Uint8Array.from([22,...parameters]));
  }
  const marker = decodeSpectrumText(Uint8Array.from([14,0,0,0,0,0]));
  assert.equal(marker.atoms.length, 6);
  assert.deepEqual(marker.atoms[0], {kind:'byte',value:14});
});
test('truncated controls retain exact bytes with structured byte-offset issues', () => {
  for (const bytes of [[16],[22],[22,1],[23],[23,255],[65,22,1]]) {
    const input = Uint8Array.from(bytes);
    const decoded = decodeSpectrumText(input);
    assert.equal(decoded.issues.length, 1);
    assert.equal(decoded.issues[0].code, 'truncated-control');
    assert.equal(decoded.issues[0].offset, bytes[0]===65 ? 1 : 0);
    assert.deepEqual(encoded(decoded.atoms), input);
    assert.ok(Object.isFrozen(decoded.issues[0]));
  }
});
test('all 256 byte identities survive internal text decode and re-encode', () => {
  for (let byte=0; byte<256; byte++) {
    const input = Uint8Array.of(byte);
    assert.deepEqual(encoded(decodeSpectrumText(input).atoms), input, byte);
  }
  const input = Uint8Array.from({length:256},(_,byte)=>byte);
  assert.deepEqual(encoded(decodeSpectrumText(input).atoms), input);
  assert.deepEqual(decodeSpectrumText(new Uint8Array()), { atoms:[], issues:[] });
});
test('invalid structured controls and non-byte parameters report item locations', () => {
  for (const [atom,code] of [[{kind:'control',name:'UNKNOWN',parameters:[]},'unknown-control'],[{kind:'control',name:'NUMBER',parameters:[]},'unknown-control'],[{kind:'control',name:'INK',parameters:[]},'invalid-parameters'],[{kind:'control',name:'AT',parameters:[1]},'invalid-parameters'],[{kind:'control',name:'TAB',parameters:[1,2,3]},'invalid-parameters']]) {
    const result = analyzeSpectrumText([{kind:'text',value:'ok'},atom]);
    assert.equal(result.kind, 'error');
    assert.equal(result.issues[0].code, code);
    assert.equal(result.issues[0].itemIndex, 1);
  }
  for (const value of [-1,256,0.5,NaN,Infinity]) {
    assert.equal(analyzeSpectrumText([{kind:'byte',value}]).kind, 'error');
    const result = analyzeSpectrumText([{kind:'control',name:'INK',parameters:[value]}]);
    assert.equal(result.kind, 'error');
    assert.equal(result.issues[0].parameterIndex, 0);
  }
  assert.equal(analyzeSpectrumText([{kind:'control',name:'AT',parameters:new Array(2)}]).kind, 'error');
  const text = analyzeSpectrumText([{kind:'text',value:'a😀é'}]);
  assert.equal(text.kind, 'error');
  assert.deepEqual(text.issues.map(({offset,length})=>[offset,length]), [[1,2],[3,1]]);
});
test('checked text and decoder outputs own immutable snapshots; encoder rejects copied brands', () => {
  const parameters = [2];
  const input = [{kind:'control',name:'INK',parameters}];
  const checked = analyzeSpectrumText(input);
  assert.equal(checked.kind,'success');
  parameters[0]=3;
  input.length=0;
  assert.deepEqual(encodeSpectrumText(checked.value), Uint8Array.from([16,2]));
  assert.ok(Object.isFrozen(checked.value.atoms[0].parameters));
  const first = encodeSpectrumText(checked.value);
  first[0]=0;
  assert.deepEqual(encodeSpectrumText(checked.value), Uint8Array.from([16,2]));
  assert.throws(()=>encodeSpectrumText({...checked.value}), TypeError);
  const bytes = Uint8Array.from([16,2]);
  const decoded = decodeSpectrumText(bytes);
  bytes[1]=9;
  assert.deepEqual(decoded.atoms[0].parameters,[2]);
  assert.ok(Object.isFrozen(decoded.atoms));
});
