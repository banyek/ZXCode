import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { SourceDocument, checkProgram, exportBasicSource, decodeBasicProgram, writeBasicTap, readBasicTap, analyzeSpectrumText, encodeSpectrumText, decodeSpectrumText } from '../../packages/core/dist/index.js';
const fixtures = new URL('../../tests/fixtures/', import.meta.url);
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const frame = body => {
  const bytes = Buffer.from(body, 'hex');
  const header = Buffer.alloc(4);
  header.writeUInt16BE(10, 0);
  header.writeUInt16LE(bytes.length + 1, 2);
  return Buffer.concat([header, bytes, Buffer.from([13])]);
};
/** Assertions precede reporting: digests never substitute for comparing actual bytes. */
export function runCompatibilityCorpus() {
  const manifest = JSON.parse(readFileSync(new URL('m3-corpus.json', fixtures)));
  const reports = [];
  for (const entry of manifest.fixtures) {
    const file = readFileSync(new URL(entry.file, fixtures));
    assert.equal(sha256(file), entry.sha256, `${entry.file}: reference changed; establish independent authority before updating the pin`);
    const data = JSON.parse(file);
    assert.equal(data.cases.length, entry.cases);
    if (data.romSha256 !== undefined) assert.equal(data.romSha256, manifest.romSha256);
    const images = [];
    let rejected = 0, exactExports = 0, unsupportedExports = 0;
    const image = bytes => {
      const length = Buffer.alloc(4);
      length.writeUInt32LE(bytes.length);
      images.push(length, Buffer.from(bytes));
    };
    const program = (source, expected, exactRequired) => {
      const checked = checkProgram(new SourceDocument(entry.file, source));
      assert.equal(checked.kind, 'success', `${entry.file}: ${source}`);
      assert.deepEqual(Buffer.from(checked.encodedProgram.programBytes), expected, source);
      const decoded = decodeBasicProgram(expected);
      assert.deepEqual(Buffer.from(decoded.bytes), expected);
      assert.deepEqual(Buffer.from(decoded.lines.flatMap(line => [...line.bytes])), expected);
      const exported = exportBasicSource(expected);
      assert.equal(exported.kind, exactRequired ? 'exact' : 'unsupported', `${source}: ${exported.reasons}`);
      if (exported.kind === 'exact') exactExports++;
      else { unsupportedExports++; assert.ok(exported.reasons.length > 0); }
      image(expected);
    };
    for (const item of data.cases) {
      if (entry.family === 'numeric' || entry.family === 'body' || entry.family === 'core' || entry.family === 'graphics') {
        const source = entry.family === 'numeric' ? `10 PRINT ${item.literal}` : entry.family === 'graphics' ? `10 PRINT "${item.notation}"` : item.source;
        const rejectedCase = entry.family === 'numeric' ? item.programHex === undefined : entry.family === 'body' && item.statements === undefined;
        if (rejectedCase) {
          assert.equal(checkProgram(new SourceDocument(entry.file, source)).kind, 'error', source);
          rejected++;
        } else {
          const expected = entry.family === 'body' ? frame(item.encoded) : entry.family === 'graphics' ? frame(`f522${item.byte.toString(16)}22`) : Buffer.from(item.programHex, 'hex');
          program(source, expected, !(entry.unsupportedExportSources ?? []).includes(source));
        }
      } else if (entry.family === 'controls') {
        const checked = analyzeSpectrumText(item.atoms);
        assert.equal(checked.kind, 'success');
        const expected = Buffer.from(item.bytesHex, 'hex');
        assert.deepEqual(Buffer.from(encodeSpectrumText(checked.value)), expected);
        const decoded = decodeSpectrumText(expected);
        assert.deepEqual(decoded.issues, []);
        const rebuilt = analyzeSpectrumText(decoded.atoms);
        assert.equal(rebuilt.kind, 'success');
        assert.deepEqual(Buffer.from(encodeSpectrumText(rebuilt.value)), expected);
        image(expected);
      } else if (entry.family === 'tap') {
        const expected = Buffer.from(item.tapHex, 'hex');
        const metadata = { filenameBytes: Buffer.from(item.filenameHex, 'hex'), autostart: item.autostart, variablesOffset: item.variablesOffset };
        assert.deepEqual(Buffer.from(writeBasicTap(Buffer.from(item.payloadHex, 'hex'), metadata).tapBytes), expected);
        const read = readBasicTap(expected);
        assert.equal(read.kind, 'success');
        assert.deepEqual(Buffer.from(writeBasicTap(read.programData, read.metadata).tapBytes), expected);
        image(expected);
      } else if (entry.family === 'autostart') {
        const tap = writeBasicTap(new Uint8Array(), {filenameBytes: new Uint8Array(10), autostart: item.word, variablesOffset: 0});
        const read = readBasicTap(tap.tapBytes);
        assert.equal(read.kind, 'success');
        assert.equal(read.autostartEnabled, item.enabled);
        assert.equal(read.autostartLine, item.enabled ? item.word : undefined);
        image(Uint8Array.of(item.word & 255, item.word >> 8, Number(item.enabled)));
      } else assert.fail(`Unknown corpus family: ${entry.family}`);
    }
    if (entry.file === 'escapes-rom.json') assert.equal(unsupportedExports, 8, 'Only the eight independently identified incomplete control packets lack source export');
    reports.push({file: entry.file, referenceSha256: entry.sha256, cases: entry.cases, rejected, exactExports, unsupportedExports, imageSha256: sha256(Buffer.concat(images))});
  }
  return {version: manifest.version, fixtures: reports};
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.stdout.write(JSON.stringify(runCompatibilityCorpus(), null, 2) + '\n');
