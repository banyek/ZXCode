import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {unzipSync} from 'fflate';
const sourceManifest=JSON.parse(readFileSync(new URL('../packages/extension/package.json',import.meta.url),'utf8'));
const first=new URL(`../artifacts/${sourceManifest.name}-${sourceManifest.version}.vsix`,import.meta.url);
const temporary=mkdtempSync(join(tmpdir(),'zxcode-repro-'));
try {
  const second=join(temporary,'second.vsix');
  const result=spawnSync(process.execPath,[fileURLToPath(new URL('./package-extension.mjs',import.meta.url)),second],{encoding:'utf8'});
  assert.equal(result.status,0,result.stdout+result.stderr);
  assert.deepEqual(readFileSync(first),readFileSync(second),'Two isolated package builds must be byte-identical');
  const entries=unzipSync(readFileSync(first));
  const manifest=JSON.parse(new TextDecoder().decode(entries['extension/package.json']));
  assert.equal(manifest.dependencies,undefined,'Bundled extension must not require workspace dependencies');
  assert.ok(entries[`extension/${manifest.main.replace(/^\.\//,'')}`]);
  assert.ok(!Object.keys(entries).some((path)=>/node_modules|test-runner|\.map$|\.ts$/.test(path)));
  console.log('VSIX reproducibility and bundled payload checks passed.');
} finally {rmSync(temporary,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
