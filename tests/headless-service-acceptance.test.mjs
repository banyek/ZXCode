import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {languageService} from '@zxcode/core';
import {runHeadlessAcceptance} from '../scripts/compatibility/run-service.mjs';
test('complete headless facade queries every UTF-16 offset of valid and incomplete corpora',(t)=>{
  assert.ok(Object.isFrozen(languageService));
  const report=runHeadlessAcceptance();
  assert.equal(report.documents.length,27);
  assert.equal(report.totalPositions,2415);
  assert.equal(report.totalQueries,report.totalPositions*6+27*2);
  const root=mkdtempSync(join(tmpdir(),'zxcode-parity-'));
  t.after(()=>rmSync(root,{recursive:true,force:true}));
  for(const platform of ['ubuntu-latest','macos-latest','windows-latest']) {
    const folder=join(root,`m4-language-service-${platform}`);
    mkdirSync(folder);writeFileSync(join(folder,'m4-language-service.json'),JSON.stringify(report));
  }
  const script=fileURLToPath(new URL('../scripts/compatibility/compare-service-reports.mjs',import.meta.url));
  const equal=spawnSync(process.execPath,[script,root],{encoding:'utf8'});
  assert.ifError(equal.error);assert.equal(equal.status,0,equal.stderr);
  const changed=structuredClone(report);changed.documents[0].querySha256='different';
  writeFileSync(join(root,'m4-language-service-windows-latest','m4-language-service.json'),JSON.stringify(changed));
  const different=spawnSync(process.execPath,[script,root],{encoding:'utf8'});
  assert.ifError(different.error);assert.notEqual(different.status,0);
  for(const document of report.documents) {
    assert.match(document.querySha256,/^[0-9a-f]{64}$/);
    assert.equal(document.queries,document.positions*6+2);
  }
});
