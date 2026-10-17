import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { runCompatibilityCorpus } from './run-corpus.mjs';
export function verifyCompatibilityAcceptance() {
  const baseline = JSON.parse(readFileSync(new URL('../../tests/fixtures/m3-acceptance.json', import.meta.url)));
  const actual = runCompatibilityCorpus();
  assert.deepEqual(actual, baseline, 'M3 acceptance differs from the independently derived report');
  return actual;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  assert.ok(args.length === 0 || (args.length === 2 && args[0] === '--report'), 'Usage: acceptance.mjs [--report path]');
  const report = JSON.stringify(verifyCompatibilityAcceptance(), null, 2) + '\n';
  if (args.length === 2) { mkdirSync(dirname(args[1]), {recursive: true}); writeFileSync(args[1], report, 'utf8'); }
  process.stdout.write(report);
}
