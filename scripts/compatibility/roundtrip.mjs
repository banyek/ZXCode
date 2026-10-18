import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {importTapSource,writeBasicTap,buildTap,readBasicTap,SourceDocument} from '../../packages/core/dist/index.js';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export function verifySemanticRoundtrip() {
 const fixture=JSON.parse(readFileSync(new URL('../../tests/fixtures/core-corpus.json',import.meta.url)));
 const manifest=JSON.parse(readFileSync(new URL('../../tests/fixtures/m3-corpus.json',import.meta.url)));
 const pin=manifest.fixtures.find(entry=>entry.file==='core-corpus.json');assert.ok(pin);
 assert.equal(hash(readFileSync(new URL('../../tests/fixtures/core-corpus.json',import.meta.url))),pin.sha256);
 const cases=fixture.cases.map(item=>{
   const program=Buffer.from(item.programHex,'hex');
   const original=writeBasicTap(program,{filenameBytes:Uint8Array.from([79,82,73,71,73,78,65,76,32,32]),autostart:0x8000,variablesOffset:program.length});
   const imported=importTapSource(original.tapBytes);assert.equal(imported.kind,'ready',item.name);
   const rebuilt=buildTap(new SourceDocument(item.name+'.zxbas',imported.source),{filenameBytes:Uint8Array.from([73,77,80,79,82,84,69,68,32,32]),autostart:10});
   assert.equal(rebuilt.kind,'success',item.name);
   const inspected=readBasicTap(rebuilt.tap.tapBytes);assert.equal(inspected.kind,'success');
   assert.deepEqual(Buffer.from(inspected.programData),program,item.name);
   assert.equal(inspected.metadata.autostart,10);assert.notDeepEqual(rebuilt.tap.tapBytes,original.tapBytes);
   const repeated=importTapSource(rebuilt.tap.tapBytes);assert.equal(repeated.kind,'ready');assert.equal(repeated.source,imported.source);
   return {name:item.name,programBytes:program.length,programSha256:hash(program),sourceSha256:hash(imported.source),normalization:['exported-source-spelling','explicit-cassette-name','explicit-autostart']};
 });
 return {schemaVersion:1,guarantee:'identical-basic-bytes',cases};
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) process.stdout.write(JSON.stringify(verifySemanticRoundtrip(),null,2)+'\n');
