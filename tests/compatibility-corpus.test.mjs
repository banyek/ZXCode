import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyCompatibilityAcceptance } from '../scripts/compatibility/acceptance.mjs';
test('pinned independent M3 corpus compares exact bytes and reports deterministic export limits', () => {
  const report = verifyCompatibilityAcceptance();
  assert.deepEqual(report, verifyCompatibilityAcceptance());
  assert.equal(report.fixtures.length, 9);
  const total = key => report.fixtures.reduce((sum, entry) => sum + entry[key], 0);
  assert.equal(total('cases'), 448);
  assert.equal(total('rejected'), 9);
  assert.equal(total('exactExports'), 389);
  assert.equal(total('unsupportedExports'), 8);
});
