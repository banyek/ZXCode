import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { analyzeBasic, checkProgram, parseBasic, ROM_TOKENS, SourceDocument, SPECTRUM_CHARACTERS, spectrumCharacter, spectrumLiteralByte } from '@zxcode/core';
const reference = JSON.parse(readFileSync(new URL('./fixtures/characters-rom.json', import.meta.url), 'utf8'));
test('every Spectrum byte has one immutable category, display and structured export identity', () => {
  assert.equal(SPECTRUM_CHARACTERS.length, 256);
  assert.equal(new Set(SPECTRUM_CHARACTERS.map((item) => item.id)).size, 256);
  const reserved = new Set(reference.reserved);
  const controls = new Set(reference.controls.map((item) => item.byte));
  const special = new Set(reference.specialGlyphs.map((item) => item.byte));
  for (let byte = 0; byte < 256; byte++) {
    const item = spectrumCharacter(byte);
    assert.equal(item, SPECTRUM_CHARACTERS[byte]);
    assert.equal(item.byte, byte);
    const expected = reserved.has(byte) ? 'reserved' : controls.has(byte) ? 'control' : byte < 128 ? special.has(byte) ? 'spectrum-glyph' : 'printable' : byte < 144 ? 'block-graphic' : byte < 165 ? 'udg' : 'token';
    assert.equal(item.category, expected, byte.toString(16));
    assert.equal(typeof item.displayText, 'string');
    assert.ok(Object.isFrozen(item));
    assert.ok(Object.isFrozen(item.exportIdentity));
  }
  assert.ok(Object.isFrozen(SPECTRUM_CHARACTERS));
  for (const invalid of [-1,256,0.5,NaN,Infinity]) assert.equal(spectrumCharacter(invalid), undefined);
});
test('control and numeric-marker identities preserve context and parameter arity', () => {
  for (const { byte, name } of reference.controls) {
    const item = spectrumCharacter(byte);
    if (byte === 14) {
      assert.deepEqual(item.exportIdentity, { kind: 'numeric-marker' });
      assert.equal(item.basicPayloadLength, 5);
      assert.equal(item.parameterCount, undefined);
    } else assert.deepEqual(item.exportIdentity, { kind: 'control', name });
    if (byte >= 16) assert.equal(item.parameterCount, byte <= 21 ? 1 : 2);
  }
  assert.notDeepEqual(spectrumCharacter(6).exportIdentity, spectrumCharacter(44).exportIdentity);
});
test('canonical printable identities distinguish original Spectrum glyphs from host ASCII', () => {
  for (const { byte, text } of reference.specialGlyphs) {
    assert.equal(spectrumCharacter(byte).literalCharacter, text);
    assert.equal(spectrumCharacter(byte).displayText, text);
    assert.equal(spectrumLiteralByte(text), byte);
  }
  for (let byte = 32; byte < 127; byte++) {
    if (byte === 96) continue;
    assert.equal(spectrumLiteralByte(String.fromCharCode(byte)), byte);
  }
  assert.deepEqual(spectrumCharacter(94).sourceAliases, ['^']);
  assert.ok(Object.isFrozen(spectrumCharacter(94).sourceAliases));
  for (const text of ['`','é','😀','\t','\x7f','PRINT','{INK 2}','▝']) assert.equal(spectrumLiteralByte(text), undefined, text);
});
test('block, UDG and token export identities never collapse into display glyphs', () => {
  for (const block of reference.blocks) {
    const item = spectrumCharacter(block.byte);
    assert.equal(item.displayText, block.display);
    assert.deepEqual(item.exportIdentity, { kind: 'block', mask: block.byte - 128 });
  }
  assert.equal(spectrumCharacter(32).displayText, spectrumCharacter(128).displayText);
  assert.notDeepEqual(spectrumCharacter(32).exportIdentity, spectrumCharacter(128).exportIdentity);
  for (let byte = 144; byte <= 164; byte++) assert.deepEqual(spectrumCharacter(byte).exportIdentity, { kind: 'udg', letter: String.fromCharCode(65 + byte - 144) });
  assert.equal(spectrumLiteralByte('A'), 65);
  for (const token of ROM_TOKENS) {
    const item = spectrumCharacter(token.byte);
    assert.equal(item.token, token);
    assert.deepEqual(item.exportIdentity, { kind: 'token', spelling: token.spelling });
  }
});
test('strings and REM share exact Spectrum glyph emission without global tokenization', () => {
  for (const entry of reference.literalCases) {
    const result = checkProgram(new SourceDocument('glyphs', entry.source));
    assert.equal(result.kind, 'success', entry.source);
    assert.equal(Buffer.from(result.encodedProgram.programBytes.slice(4)).toString('hex'), entry.bodyHex);
  }
  const text = '10 PRINT "PRINT {{INK 2}} \\ £": REM PRINT {{INK 2}} \\ £';
  const input = parseBasic(new SourceDocument('raw', text));
  const result = analyzeBasic(input);
  assert.equal(result.kind, 'buildable');
  const [print, rem] = result.analysis.program.lines[0].statements;
  assert.equal(print.items[0].expression.bytes.at(-1), 96);
  assert.equal(rem.bytes.at(-1), 96);
  assert.equal(rem.text, ' PRINT {{INK 2}} \\ £');
  assert.ok(!print.items[0].expression.bytes.includes(0xf5));
  assert.equal(checkProgram(new SourceDocument('operator', '10 PRINT 2↑3')).kind, 'error');
});
