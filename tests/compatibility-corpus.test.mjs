import test from 'node:test';
import assert from 'node:assert/strict';
import { runCompatibilityCorpus } from '../scripts/compatibility/run-corpus.mjs';
test('pinned independent M3 corpus compares exact bytes and reports deterministic export limits', () => {
  const report = runCompatibilityCorpus();
  assert.deepEqual(report, runCompatibilityCorpus());
  assert.equal(report.fixtures.length, 9);
  const total = key => report.fixtures.reduce((sum, entry) => sum + entry[key], 0);
  assert.equal(total('cases'), 448);
  assert.equal(total('rejected'), 9);
  assert.equal(total('exactExports'), 389);
  assert.equal(total('unsupportedExports'), 8);
});
