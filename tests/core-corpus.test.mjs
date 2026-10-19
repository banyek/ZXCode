import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { analyzeBasic, BUILTIN_SIGNATURES, checkProgram, parseBasic, ROM_TOKENS, SourceDocument } from '@zxcode/core';
const fixture = JSON.parse(readFileSync(new URL('./fixtures/core-corpus.json', import.meta.url), 'utf8'));
test('eight combined BASIC programs encode against independently justified images', () => {
  for (const entry of fixture.cases) {
    assert.equal(readFileSync(new URL(`../${entry.sourcePath}`, import.meta.url), 'utf8'), entry.source, entry.name);
    const result = checkProgram(new SourceDocument(entry.name, entry.source));
    assert.equal(result.kind, 'success', entry.name);
    assert.equal(Buffer.from(result.encodedProgram.programBytes).toString('hex'), entry.programHex, entry.name);
    const repeated = checkProgram(new SourceDocument(entry.name, entry.source));
    assert.deepEqual(repeated.encodedProgram.programBytes, result.encodedProgram.programBytes);
    assert.deepEqual(repeated.encodedProgram.lines, result.encodedProgram.lines);
    const bytes = result.encodedProgram.programBytes;
    for (const line of result.encodedProgram.lines) {
      assert.equal(bytes[line.encodedOffset + line.encodedLength - 1], 13);
      for (const statement of line.statements) {
        assert.ok(statement.encodedRange.offset >= line.encodedOffset + 4);
        assert.ok(statement.encodedRange.offset + statement.encodedRange.length <= line.encodedOffset + line.encodedLength - 1);
      }
    }
  }
});
test('combined and focused independent fixtures cover every ROM command and builtin signature', () => {
  const commands = new Set();
  const builtins = new Set();
  const kinds = new Set();
  const visit = (value) => {
    if (value === undefined || value === null || typeof value !== 'object') return;
    if (value.kind) kinds.add(value.kind);
    if (value.kind === 'simple-command') commands.add(value.definition.token.spelling);
    else if (value.kind === 'cassette') commands.add(value.command);
    else if (value.kind === 'def-fn') commands.add('DEF FN');
    else if (value.kind === 'goto') commands.add('GO TO');
    else if (value.kind === 'gosub') commands.add('GO SUB');
    else if (['if','for','next','dim','let','print','lprint','input','data','read','list','llist','rem','cls','stop'].includes(value.kind)) commands.add(value.kind.toUpperCase());
    if (value.kind === 'builtin-value' || value.kind === 'builtin-call') builtins.add(value.token.spelling);
    for (const child of Object.values(value)) visit(child);
  };
  const paths = ['simple-commands','assignment','control-flow','loops','print','input','arrays','data','functions','storage'];
  const programs = [...fixture.cases, ...paths.flatMap((name) => JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8')).cases)];
  for (const entry of programs) {
    const result = analyzeBasic(parseBasic(new SourceDocument('coverage', entry.source)));
    assert.equal(result.kind, 'buildable', entry.source);
    visit(result.analysis.program);
  }
  assert.deepEqual([...commands].sort(), ROM_TOKENS.filter((token) => token.category === 'statement').map((token) => token.spelling).sort());
  assert.deepEqual([...builtins].sort(), BUILTIN_SIGNATURES.map((item) => item.token.spelling).sort());
  for (const kind of ['array-access','string-access','number','binary-literal','string','name','builtin-value','builtin-call','user-function-call','unary','binary','parenthesized','scalar-target','indexed-target','print-empty','print-separator','print-expression','print-at','print-tab','print-control','print-channel','input-target','input-display','input-group','input-separator','input-empty','empty']) assert.ok(kinds.has(kind), kind);
});
test('unsupported dialect constructs and malformed combinations fail structurally', () => {
  for (const body of ['WHILE a: PRINT 1', 'WEND', 'IF a THEN 20', 'PRINT LEFT$(a$,2)', 'LET a=1 ELSE PRINT 2', 'DIM a(2),b(2)', 'NEXT', 'READ a+1', 'SAVE "x" CODE']) {
    const parsed = parseBasic(new SourceDocument('unsupported', `10 ${body}\n20 PRINT 2`));
    assert.ok(parsed.diagnostics.some((item) => item.severity === 'error'), body);
    assert.equal(parsed.syntax.lines[1].statements[0].kind, 'print', body);
    assert.equal(analyzeBasic(Object.freeze({ ...parsed, diagnostics: Object.freeze([]) })).kind, 'invalid', body);
  }
});
