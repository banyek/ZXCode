import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync,writeFileSync,mkdtempSync,rmSync,existsSync,linkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { importTapSource,writeBasicTap,checkProgram,SourceDocument,decodeBasicProgram } from '../packages/core/dist/index.js';
const fixture=JSON.parse(readFileSync(new URL('./fixtures/core-corpus.json',import.meta.url)));
const metadata=variablesOffset=>({filenameBytes:Uint8Array.from([88,32,32,32,32,32,32,32,32,32]),autostart:10,variablesOffset});
const wrap=(program,variables=[])=>writeBasicTap(Uint8Array.from([...program,...variables]),metadata(program.length)).tapBytes;
const program=()=>Buffer.from(fixture.cases[0].programHex,'hex');
const entry=fileURLToPath(new URL('../packages/cli/bin/zxcode.mjs',import.meta.url));
const run=args=>spawnSync(process.execPath,[entry,'import',...args],{encoding:'utf8'});
test('product imports all independently referenced core images only with exact binary proof',()=>{
 for(const item of fixture.cases) {
   const bytes=Buffer.from(item.programHex,'hex');const result=importTapSource(wrap(bytes));
   assert.equal(result.kind,'ready',item.name);
   assert.deepEqual(checkProgram(new SourceDocument('imported',result.source)).encodedProgram.programBytes,Uint8Array.from(bytes));
   assert.ok(Object.isFrozen(result.metadata.filenameBytes));
 }
});
test('saved variables require explicit source-only policy, and never become source declarations',()=>{
 const bytes=wrap(program(),[128,0,255]);
 assert.equal(importTapSource(bytes).reason,'saved-variables');
 const result=importTapSource(bytes,{variables:'source-only'});
 assert.equal(result.kind,'ready');assert.equal(result.metadata.omittedVariableBytes,3);
 assert.deepEqual(checkProgram(new SourceDocument('x',result.source)).encodedProgram.programBytes,Uint8Array.from(program()));
 assert.throws(()=>importTapSource(bytes,{variables:'guess'}));
});
test('malformed framing and altered hidden numbers return explicit blocked results without accepted source',()=>{
 assert.equal(importTapSource(Uint8Array.of(1)).reason,'tap-error');
 const bytes=program();const decoded=decodeBasicProgram(bytes);
 const slot=decoded.lines.flatMap(line=>line.segments).find(segment=>segment.kind==='number-storage');assert.ok(slot);
 bytes[slot.offset+2]^=1;
 const result=importTapSource(wrap(bytes));assert.equal(result.reason,'unsupported-program');assert.equal(result.source,undefined);assert.ok(result.issues.length>0);
});
test('CLI imports source plus deterministic metadata and refuses any existing output',()=>{
 const dir=mkdtempSync(join(tmpdir(),'zxcode-import-'));
 try {
   const input=join(dir,'original.tap');const bytes=wrap(program());writeFileSync(input,bytes);
   let result=run([input]);assert.equal(result.status,0,result.stderr);
   const output=join(dir,'original.zxbas');const source=readFileSync(output,'utf8');const report=JSON.parse(readFileSync(output+'.import.json','utf8'));
   assert.equal(report.tapSha256,createHash('sha256').update(bytes).digest('hex'));
   assert.equal(report.sourceSha256,createHash('sha256').update(source).digest('hex'));
   assert.equal(report.autostart,10);assert.equal(report.omittedVariableBytes,0);
   assert.equal(run([input]).status,1);assert.equal(readFileSync(output,'utf8'),source);
   assert.equal(run([input,'-o',input]).status,1);assert.deepEqual(readFileSync(input),Buffer.from(bytes));
   const alias=join(dir,'alias.zxbas');linkSync(input,alias);assert.equal(run([input,'-o',alias]).status,1);
   const denied=join(dir,'denied.zxbas');writeFileSync(denied+'.import.json','existing');
   result=run([input,'-o',denied]);assert.equal(result.status,1);assert.equal(existsSync(denied),false);assert.equal(readFileSync(denied+'.import.json','utf8'),'existing');
 } finally {rmSync(dir,{recursive:true,force:true});}
});
test('CLI source-only consent is explicit and unsupported imports create no outputs',()=>{
 const dir=mkdtempSync(join(tmpdir(),'zxcode-import-'));
 try {
   const input=join(dir,'saved.tap');writeFileSync(input,wrap(program(),[128]));
   assert.equal(run([input]).status,1);assert.equal(existsSync(join(dir,'saved.zxbas')),false);
   const result=run([input,'--source-only']);assert.equal(result.status,0,result.stderr);assert.match(result.stderr,/omitted 1 saved-variable/);
   assert.equal(JSON.parse(readFileSync(join(dir,'saved.zxbas.import.json'))).omittedVariableBytes,1);
   const broken=join(dir,'broken.tap');writeFileSync(broken,Uint8Array.of(1));assert.equal(run([broken]).status,1);assert.equal(existsSync(join(dir,'broken.zxbas')),false);
   assert.equal(run([]).status,2);assert.equal(run([input,'--normalize']).status,2);
 } finally {rmSync(dir,{recursive:true,force:true});}
});
