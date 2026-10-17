import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
const directory=process.argv[2];
assert.ok(directory,'Provide downloaded VSIX artifact directory');
const platforms=['ubuntu-latest','macos-latest','windows-latest'];
const reports=platforms.map((platform)=>{
  const folder=join(directory,`zxcode-vsix-${platform}`);
  const files=readdirSync(folder).filter((name)=>name.endsWith('.vsix.json'));
  assert.equal(files.length,1,`Expected one VSIX manifest on ${platform}`);
  return JSON.parse(readFileSync(join(folder,files[0]),'utf8'));
});
for(let index=1;index<reports.length;index++) assert.deepEqual(reports[index],reports[0],`VSIX bytes/payload differ on ${platforms[index]}`);
console.log(`M5 VSIX platform parity passed: ${reports[0].sha256}`);
