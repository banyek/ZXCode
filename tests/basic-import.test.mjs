import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decodeBasicProgram, exportBasicSource, inspectBasicTap, writeBasicTap, SourceDocument, checkProgram } from '../packages/core/dist/index.js';
const fixture = JSON.parse(readFileSync(new URL('./fixtures/core-corpus.json', import.meta.url)));
const encoded = (source) => {
  const checked = checkProgram(new SourceDocument('import-test.bas', source));
  assert.equal(checked.kind, 'success', JSON.stringify(checked.diagnostics));
  return checked.encodedProgram.programBytes;
};
const record = (body, number = 10) => Uint8Array.from([number >> 8, number & 255, (body.length + 1) & 255, (body.length + 1) >> 8, ...body, 13]);
const metadata = (variablesOffset) => ({filenameBytes: Uint8Array.from([88,32,32,32,32,32,32,32,32,32]), autostart: 0x8000, variablesOffset});
test('all eight independently referenced core programs decode and export exact source', () => {
  for (const item of fixture.cases) {
    const bytes = Buffer.from(item.programHex, 'hex');
    const result = exportBasicSource(bytes);
    assert.equal(result.kind, 'exact', `${item.name}: ${result.reasons}`);
    assert.deepEqual(encoded(result.candidateSource), Uint8Array.from(bytes));
    assert.equal(result.decoded.issues.length, 0);
    assert.deepEqual(Uint8Array.from(result.decoded.lines.flatMap(line => [...line.bytes])), Uint8Array.from(bytes));
    assert.deepEqual(exportBasicSource(bytes), result);
  }
});
test('string/REM contexts retain raw tokens, braces, controls and embedded REM terminators', () => {
  const source = '10 REM{BYTE 0x00}{ENTER}{BYTE 0xEA}{{hello}}\n20 LET a$="{UDG A}{BLOCK 15}{INK 2}{AT 0,34}{BYTE 0xFF}{{}}"\n30 PRINT 2^2\n';
  // The string payload includes a doubled quote as an AT parameter, not a string boundary.
  const bytes = encoded(source);
  const result = exportBasicSource(bytes);
  assert.equal(result.kind, 'exact', result.reasons.join('; '));
  assert.ok(result.decoded.lines[0].segments.some(s => s.kind === 'rem' && s.content.includes(13)));
  const string = result.decoded.lines[1].segments.find(s => s.kind === 'string');
  assert.ok(string.content.includes(255));
  assert.ok(string.content.includes(34));
});
test('numeric storage and mutable FN slots survive decoding and prevent false exact exports', () => {
  for (const source of ['10 PRINT .1\n', '10 DEF FN f(x)=x: PRINT FN f(2)\n']) {
    const bytes = encoded(source);
    const decoded = decodeBasicProgram(bytes);
    const slot = decoded.lines.flatMap(l => l.segments).find(s => s.kind === 'number-storage');
    assert.ok(slot);
    const changed = Uint8Array.from(bytes);
    changed[slot.offset + 2] ^= 1;
    const result = exportBasicSource(changed);
    assert.equal(result.kind, 'unsupported');
    assert.ok(result.reasons.some(r => r.includes('does not reproduce')));
    assert.deepEqual(result.decoded.lines.flatMap(l => l.segments).find(s => s.kind === 'number-storage').value, changed.slice(slot.offset + 1, slot.offset + 6));
  }
});
test('malformed records and unknown bytes are surfaced without invented boundaries', () => {
  for (const [bytes, code] of [
    [[0], 'truncated-line-header'], [[0,10,0,0], 'invalid-line-length'],
    [[0,10,2,0,13], 'truncated-line'], [[0,10,1,0,0], 'missing-line-terminator'],
    [record([14,1,2]), 'truncated-number'], [record([34,65]), 'unterminated-string'],
    [record([0]), 'raw-byte']
  ]) {
    const result = exportBasicSource(Uint8Array.from(bytes));
    assert.equal(result.kind, 'unsupported');
    assert.ok(result.decoded.issues.some(i => i.code === code), code);
    assert.deepEqual(result.decoded.bytes, Uint8Array.from(bytes));
  }
  assert.throws(() => decodeBasicProgram([]), TypeError);
  assert.equal(exportBasicSource(new Uint8Array()).kind, 'exact');
  // Unsupported source line numbers remain visible rather than rewritten.
  assert.equal(exportBasicSource(record([0xfb], 0)).kind, 'unsupported');
  assert.equal(exportBasicSource(record([0xfb], 10000)).kind, 'unsupported');
});
test('BASIC TAP inspection keeps saved variables separate and rejects broken framing', () => {
  const program = encoded('10 PRINT "hello"\n');
  const variables = Uint8Array.from([0,13,14,255,128]);
  const data = Uint8Array.from([...program, ...variables]);
  const tap = writeBasicTap(data, metadata(program.length)).tapBytes;
  const result = inspectBasicTap(tap);
  assert.equal(result.kind, 'decoded');
  assert.equal(result.program.kind, 'exact');
  assert.deepEqual(result.variables, variables);
  assert.deepEqual(result.program.decoded.bytes, program);
  assert.equal(inspectBasicTap(tap.slice(0, -1)).kind, 'tap-error');
});
test('decoder snapshots own Buffer inputs and segment data independently', () => {
  const original = encoded('10 PRINT "a";1\n');
  const input = Buffer.from(original);
  const decoded = decodeBasicProgram(input);
  input.fill(0);
  assert.deepEqual(decoded.bytes, original);
  const segment = decoded.lines[0].segments[0];
  segment.bytes.fill(0);
  assert.deepEqual(decoded.bytes, original);
  assert.deepEqual(decoded.lines[0].bytes, original);
  assert.ok(Object.isFrozen(decoded));
  assert.ok(Object.isFrozen(decoded.lines));
});
test('every byte survives REM export and every representable byte survives quoted export', () => {
  const raw = byte => `{BYTE 0x${byte.toString(16).padStart(2, '0')}}`;
  for (const context of ['rem', 'string']) {
    const values = Array.from({length: 256}, (_, i) => i).filter(i => context === 'rem' || i !== 13);
    const content = values.map(raw).join('');
    const bytes = encoded(context === 'rem' ? `10 REM${content}\n` : `10 PRINT "${content}"\n`);
    const result = exportBasicSource(bytes);
    assert.equal(result.kind, 'exact', `${context}: ${result.reasons}`);
    const segment = result.decoded.lines[0].segments.find(s => s.kind === context);
    assert.deepEqual(segment.content, Uint8Array.from(values));
  }
});
test('truncated text packets and noncanonical stored spacing retain bytes but cannot claim exact export', () => {
  for (const body of [[0xea, 22, 1], [0xf5,34,22,1,34], [0xfb,32]]) {
    const bytes = record(body);
    const result = exportBasicSource(bytes);
    assert.equal(result.kind, 'unsupported');
    assert.deepEqual(result.decoded.bytes, bytes);
    assert.ok(result.reasons.length > 0);
  }
});
