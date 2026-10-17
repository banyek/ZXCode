import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
const root=process.argv[2]??'artifacts/m4-platforms';
const platforms=['ubuntu-latest','macos-latest','windows-latest'];
const reports=platforms.map(platform=>JSON.parse(readFileSync(join(root,`m4-language-service-${platform}`,'m4-language-service.json'))));
for(let index=1;index<reports.length;index++) assert.deepEqual(reports[index],reports[0],`M4 service behavior differs: ${platforms[index]} versus ${platforms[0]}`);
assert.equal(reports[0].documents.length,27);
process.stdout.write(`Identical M4 reports on all three platforms: ${reports[0].documents.length} documents, ${reports[0].totalPositions} positions, ${reports[0].totalQueries} queries\n`);
