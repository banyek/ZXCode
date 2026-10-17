import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzeBasic, buildTap, checkProgram, commandAvailability, DiagnosticCodes, parseBasic, ROM_TOKENS, SourceDocument, SPECTRUM_48K_TARGET } from '@zxcode/core';
const extensionTarget = Object.freeze({ id: '48k-with-interface1', capabilities: Object.freeze(['interface1']) });
const source = (body) => new SourceDocument('capabilities', `10 ${body}`);
test('authentic extension commands build with precise nonfatal capability warnings', () => {
  for (const body of ['CAT', 'FORMAT "m"', 'MOVE "x","y"', 'ERASE "x"']) {
    const input = source(body);
    const parsed = parseBasic(input);
    assert.deepEqual(parsed.diagnostics, []);
    const result = checkProgram(input);
    assert.equal(result.kind, 'success');
    assert.equal(result.diagnostics.length, 1);
    const diagnostic = result.diagnostics[0];
    assert.equal(diagnostic.code, DiagnosticCodes.missingRuntimeCapability);
    assert.equal(diagnostic.severity, 'warning');
    assert.equal(diagnostic.category, 'compatibility');
    assert.equal(diagnostic.capability, 'interface1');
    assert.equal(input.textInRange(diagnostic.range), body);
    assert.match(diagnostic.message, /authentic ROM vocabulary/);
  }
});
test('target profile propagates consistently through analysis, check and TAP build', () => {
  const input = source('IF a THEN CAT: ERASE "x"');
  const options = { targetProfile: extensionTarget };
  const analyzed = analyzeBasic(parseBasic(input), options);
  assert.equal(analyzed.kind, 'buildable');
  assert.deepEqual(analyzed.analysis.diagnostics, []);
  const base = checkProgram(input);
  const extended = checkProgram(input, options);
  assert.equal(base.kind, 'success');
  assert.equal(extended.kind, 'success');
  assert.equal(base.diagnostics.length, 2);
  assert.deepEqual(extended.diagnostics, []);
  assert.deepEqual(base.encodedProgram.programBytes, extended.encodedProgram.programBytes);
  const tapOptions = { filenameBytes: Uint8Array.from(Buffer.from('capability')), autostart: 0x8000 };
  const tap = buildTap(input, { ...tapOptions, ...options });
  assert.equal(tap.kind, 'success');
  assert.deepEqual(tap.diagnostics, []);
  assert.equal(buildTap(input, tapOptions).diagnostics.length, 2);
});
test('base-ROM OPEN/CLOSE channels require no blanket extension capability', () => {
  for (const body of ['OPEN #4,"s"', 'OPEN #4,"K"', 'OPEN #4,"p"', 'CLOSE #4', 'OPEN #a,b$', 'CLOSE #a']) {
    const result = checkProgram(source(body));
    assert.equal(result.kind, 'success', body);
    assert.deepEqual(result.diagnostics, [], body);
  }
});
test('completion policy separates authentic vocabulary from runtime availability', () => {
  for (const token of ROM_TOKENS.filter((item) => item.category === 'statement')) {
    const base = commandAvailability(token.spelling);
    assert.equal(base.token, token);
    const requiresExtension = ['CAT','FORMAT','MOVE','ERASE'].includes(token.spelling);
    assert.equal(base.available, !requiresExtension);
    assert.equal(base.defaultCompletion, !requiresExtension);
    const extended = commandAvailability(token.spelling, extensionTarget);
    assert.equal(extended.available, true);
    assert.equal(extended.defaultCompletion, true);
    assert.ok(Object.isFrozen(base));
  }
  assert.equal(commandAvailability('PRINT').token.spelling, 'PRINT');
  assert.equal(commandAvailability('print').token.spelling, 'PRINT');
  assert.equal(commandAvailability('SIN'), undefined);
  assert.equal(commandAvailability('WHILE'), undefined);
  assert.ok(Object.isFrozen(SPECTRUM_48K_TARGET.capabilities));
});
test('declaring capabilities neither relaxes grammar nor suppresses type errors', () => {
  for (const body of ['CAT 1', 'FORMAT 2', 'MOVE "x",2', 'ERASE', 'OPEN #"x",2', 'CLOSE #"x"']) {
    const result = checkProgram(source(body), { targetProfile: extensionTarget });
    assert.equal(result.kind, 'error', body);
    assert.ok(result.diagnostics.some((item) => item.severity === 'error'), body);
  }
});
