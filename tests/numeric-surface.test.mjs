import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { analyzeBasic, checkProgram, convertNumericLiteral, parseBasic, parseExpression, SourceDocument } from '@zxcode/core';
const parsed = (body) => parseBasic(new SourceDocument('numeric-surface', `10 ${body}`));
test('numeric lexical classes encode canonical text and independently observed ROM bytes', () => {
  const fixture = JSON.parse(readFileSync(new URL('./fixtures/numeric-surface-rom.json', import.meta.url), 'utf8'));
  for (const entry of fixture.cases) {
    const input = parsed(`PRINT ${entry.literal}`);
    const result = checkProgram(input.source);
    assert.equal(result.kind, entry.storage === undefined ? 'error' : 'success', entry.literal);
    if (result.kind === 'success') {
      assert.equal(Buffer.from(result.encodedProgram.programBytes).toString('hex'), entry.programHex, entry.literal);
      assert.equal(input.syntax.lines[0].statements[0].items[0].expression.lexeme, entry.canonical);
    }
  }
});
test('whitespace positions, exponent boundaries and unary signs match original ROM syntax', () => {
  const fixture = JSON.parse(readFileSync(new URL('./fixtures/numeric-syntax-rom.json', import.meta.url), 'utf8'));
  for (const entry of fixture.cases) assert.equal(checkProgram(new SourceDocument('syntax', entry.source)).kind, entry.statements === undefined ? 'error' : 'success', entry.source);
});
test('raw numeric token ranges survive compact semantic spelling and source mapping', () => {
  const input = parsed('PRINT 1.2 \t3 E + 2;4');
  assert.deepEqual(input.diagnostics, []);
  const line = input.syntax.lines[0];
  const token = line.tokens.find((token) => token.kind === 'number');
  assert.equal(token.text, '1.2 \t3 E + 2');
  const literal = line.statements[0].items[0].expression;
  assert.equal(literal.lexeme, '1.23E+2');
  assert.equal(input.source.textInRange(literal.range), token.text);
  assert.equal(line.tokens.map((token) => token.text).join(''), 'PRINT 1.2 \t3 E + 2;4');
  const semantic = analyzeBasic(input);
  assert.equal(semantic.kind, 'buildable');
  assert.equal(semantic.analysis.program.lines[0].statements[0].items[0].expression.value.lexeme, '1.23E+2');
  const source = new SourceDocument('expression', '. 5');
  assert.equal(parseExpression(source, source.range(0, source.text.length)).syntax.lexeme, '.5');
});
test('provisional numeric scanning preserves raw variable names and operator boundaries', () => {
  for (const body of ['PRINT a 1E + 2', 'LET a 1E=2', 'PRINT a 1E + 2. 3', 'PRINT a 1E + 2E + 3', 'PRINT a 1E + 2: REM PRINT : "unfinished', 'LET a=1. 2: LET b=. 5', 'DIM a(1E + 2): LET a(1)=. 5', 'DEF FN f(x)=x+1. 2: PRINT FN f(. 5)', 'SAVE STR$ 1. 2 CODE 1E + 2,3']) assert.equal(checkProgram(parsed(body).source).kind, 'success', body);
  const input = parsed('PRINT a 1E + 2');
  const expression = input.syntax.lines[0].statements[0].items[0].expression;
  assert.equal(expression.kind, 'binary-expression');
  assert.equal(expression.left.identity.canonicalName, 'a1e');
  assert.equal(expression.right.lexeme, '2');
});
test('numeric-looking strings and REM remain untouched; converter stays a compact-lexeme API', () => {
  const input = parsed('PRINT "1 E + 2": REM 1. 2 E +');
  assert.deepEqual(input.diagnostics, []);
  assert.equal(input.syntax.lines[0].statements[0].items[0].expression.value, '1 E + 2');
  assert.equal(input.syntax.lines[0].statements[1].text, ' 1. 2 E +');
  assert.equal(checkProgram(input.source).kind, 'success');
  assert.equal(convertNumericLiteral('1E +2').kind, 'error');
  assert.equal(convertNumericLiteral('-1').kind, 'error');
});
test('malformed exponent snapshots recover and cannot become buildable without diagnostics', () => {
  for (const body of ['PRINT 1E +', 'PRINT 1 E2', 'PRINT 1E2 3', 'PRINT .', 'PRINT 1.2 E + + 2']) {
    const input = parsed(`${body}: PRINT 2`);
    assert.ok(input.diagnostics.length > 0, body);
    assert.equal(input.syntax.lines[0].statements.at(-1).kind, 'print', body);
    assert.equal(analyzeBasic(Object.freeze({ ...input, diagnostics: Object.freeze([]) })).kind, 'invalid', body);
  }
});
