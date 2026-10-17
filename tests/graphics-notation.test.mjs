import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { analyzeSpectrumText, decodeSpectrumText, encodeSpectrumText, parseSpectrumGraphicNotation, spectrumCharacter, spectrumGraphicNotation, spectrumLiteralByte, SPECTRUM_GRAPHIC_NOTATIONS } from '@zxcode/core';
const fixture = JSON.parse(readFileSync(new URL('./fixtures/graphics-notation.json', import.meta.url), 'utf8'));
test('all sixteen blocks and twenty-one UDGs have portable exact notation', () => {
  assert.equal(SPECTRUM_GRAPHIC_NOTATIONS.length, 37);
  for (const entry of fixture.cases) {
    const parsed = parseSpectrumGraphicNotation(entry.notation);
    assert.equal(parsed.byte, entry.byte, entry.notation);
    assert.equal(parsed.canonicalText, entry.notation);
    assert.equal(spectrumGraphicNotation(entry.byte), parsed);
    assert.equal(parsed.identity, spectrumCharacter(entry.byte).exportIdentity);
    assert.ok(Object.isFrozen(parsed));
  }
  assert.ok(Object.isFrozen(SPECTRUM_GRAPHIC_NOTATIONS));
});
test('ASCII case and internal formatting normalize without changing byte identity', () => {
  for (const [text,canonical] of [['{udg a}','{UDG A}'],['{ UDG\tu }','{UDG U}'],['{block 15}','{BLOCK 15}'],['{\tBLOCK 0\t}','{BLOCK 0}']]) assert.equal(parseSpectrumGraphicNotation(text).canonicalText, canonical);
});
test('graphics notation rejects ambiguous, non-48K and malformed spellings', () => {
  for (const text of ['{UDG V}','{UDG AA}','{UDG Ω}','{UDG Α}','{BLOCK 16}','{BLOCK -1}','{BLOCK 01}','{BLOCK 0xF}','{BLOCK 1+2}','{BLOCK １}','{UDGA}','{BLOCK15}','UDG A','{UDG A','{UDG A}}','{UDG A}\n',' {UDG A}','▟','A','{UDG A}{UDG B}']) assert.equal(parseSpectrumGraphicNotation(text), undefined, text);
  for (const byte of [-1,0,32,65,127,165,255,256,128.5,NaN]) assert.equal(spectrumGraphicNotation(byte), undefined, byte);
});
test('notation bytes survive checked text encoding and decoder export identity round trips', () => {
  for (const entry of fixture.cases) {
    const source = parseSpectrumGraphicNotation(entry.notation);
    const checked = analyzeSpectrumText([{kind:'byte',value:source.byte}]);
    assert.equal(checked.kind,'success');
    const bytes = encodeSpectrumText(checked.value);
    assert.deepEqual(bytes,Uint8Array.of(entry.byte));
    const decoded = decodeSpectrumText(bytes);
    assert.deepEqual(decoded.issues,[]);
    assert.deepEqual(decoded.atoms,[{kind:'byte',value:entry.byte}]);
    assert.equal(spectrumGraphicNotation(decoded.atoms[0].value).canonicalText, entry.notation);
  }
});
test('blank graphics and mutable UDG slots remain distinct from literal glyphs', () => {
  assert.equal(parseSpectrumGraphicNotation('{BLOCK 0}').byte,128);
  assert.equal(spectrumLiteralByte(' '),32);
  assert.equal(parseSpectrumGraphicNotation('{UDG A}').byte,144);
  assert.equal(spectrumLiteralByte('A'),65);
  assert.equal(spectrumLiteralByte('█'),undefined);
  assert.equal(parseSpectrumGraphicNotation('{UDG T}').byte,163);
  assert.equal(parseSpectrumGraphicNotation('{UDG U}').byte,164);
});
