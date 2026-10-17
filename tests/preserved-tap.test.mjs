import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync,writeFileSync,mkdtempSync,rmSync,existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { SourceDocument,importTapSource,rebuildPreservedTap,writeBasicTap,checkProgram,decodeBasicProgram } from '../packages/core/dist/index.js';
const cases=JSON.parse(readFileSync(new URL('./fixtures/core-corpus.json',import.meta.url))).cases;
const wrap=(program,variables=[],autostart=0xffff)=>writeBasicTap(Uint8Array.from([...program,...variables]),{filenameBytes:Uint8Array.from([0,255,13,34,65,0,32,128,1,90]),autostart,variablesOffset:program.length}).tapBytes;
const entry=fileURLToPath(new URL('../packages/cli/bin/zxcode.mjs',import.meta.url));
test('selected preserving rebuild reproduces all independent core TAPs including opaque metadata and variables',()=>{
 for(const item of cases) {
   const bytes=wrap(Buffer.from(item.programHex,'hex'),[0,128,255,13]);
   const imported=importTapSource(bytes,{variables:'source-only'});assert.equal(imported.kind,'ready');
   const result=rebuildPreservedTap(new SourceDocument(item.name,imported.source),bytes);
   assert.equal(result.kind,'success');assert.equal(result.guarantee,'identical-tap-bytes');assert.equal(result.preservedVariableBytes,4);assert.deepEqual(result.tap.tapBytes,bytes);
 }
});
test('preserving rebuild accepts harmless source spacing but rejects changed visible numeric bytes',()=>{
 const bytes=checkProgram(new SourceDocument('x','10 PRINT 1\n')).encodedProgram.programBytes;const reference=wrap(bytes);
 assert.equal(rebuildPreservedTap(new SourceDocument('x','0010  print   1\r\n'),reference).kind,'success');
 for(const text of ['10 PRINT 1.0\n','10 PRINT 2\n']) {const result=rebuildPreservedTap(new SourceDocument('x',text),reference);assert.equal(result.reason,'changed-program');assert.equal(result.tap,undefined);}
 assert.equal(rebuildPreservedTap(new SourceDocument('x','10 PRINT "\n'),reference).reason,'invalid-source');
});
test('unsupported/mutated reference data cannot falsely claim preservation',()=>{
 const bytes=Buffer.from(cases[0].programHex,'hex');const imported=importTapSource(wrap(bytes));
 const slot=decodeBasicProgram(bytes).lines.flatMap(line=>line.segments).find(segment=>segment.kind==='number-storage');bytes[slot.offset+2]^=1;
 assert.equal(rebuildPreservedTap(new SourceDocument('x',imported.source),wrap(bytes)).reason,'unsupported-reference');
 assert.equal(rebuildPreservedTap(new SourceDocument('x','10 STOP\n'),Uint8Array.of(1)).reason,'unsupported-reference');
});
test('CLI explicit reference rebuild writes identical bytes and protects source, reference and existing outputs',()=>{
 const dir=mkdtempSync(join(tmpdir(),'zxcode-preserve-'));
 try {
   const bytes=wrap(Buffer.from(cases[0].programHex,'hex'),[128]);const reference=join(dir,'original.tap'), source=join(dir,'source.zxbas');writeFileSync(reference,bytes);writeFileSync(source,importTapSource(bytes,{variables:'source-only'}).source);
   const run=args=>spawnSync(process.execPath,[entry,'rebuild',...args],{encoding:'utf8'});
   const result=run([source,'--reference',reference]);assert.equal(result.status,0,result.stderr);assert.match(result.stdout,/preserved 1 saved-variable/);
   assert.deepEqual(readFileSync(join(dir,'source.preserved.tap')),Buffer.from(bytes));
   assert.equal(run([source,'--reference',reference]).status,1);
   assert.equal(run([source,'--reference',reference,'-o',source]).status,1);
   assert.equal(run([source,'--reference',reference,'-o',reference]).status,1);assert.deepEqual(readFileSync(reference),Buffer.from(bytes));
   writeFileSync(source,'10 STOP\n');const denied=join(dir,'denied.tap');assert.equal(run([source,'--reference',reference,'-o',denied]).status,1);assert.equal(existsSync(denied),false);
   assert.equal(run([source]).status,2);
 } finally {rmSync(dir,{recursive:true,force:true});}
});
