import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {access,readFile} from 'node:fs/promises';
import test from 'node:test';
import {SourceDocument,readBasicTap} from '../packages/core/dist/index.js';
import {RunCoordinator} from '../packages/runner/dist/index.js';
import {backend} from './fixtures/runner/backend.mjs';
const text='100 REM £©↑\r\n20 PRINT 1\r\n';
const input=(value=text,version=1)=>({source:new SourceDocument('file:///identity.zxbas',value),version});
const hash=(value)=>createHash('sha256').update(value).digest('hex');
test('persisted metadata binds exact source, TAP/image hashes and immutable checked source maps',async()=>{
  const fake=backend();const coordinator=new RunCoordinator(fake);
  try {
    const built=await coordinator.run(input());assert.equal(built.kind,'success');
    const run=built.run;const metadata=run.metadata;
    const bytes=await readFile(run.session.artifact.path);
    const tape=readBasicTap(bytes);assert.equal(tape.kind,'success');
    assert.equal(metadata.buildId,run.session.artifact.buildId);
    assert.equal(metadata.source.text,text);assert.equal(metadata.sourceVersion,1);
    assert.equal(metadata.sourceSha256,hash(text));assert.equal(metadata.tapSha256,hash(bytes));assert.equal(metadata.programSha256,hash(tape.programData));
    assert.equal(metadata.tapByteLength,bytes.length);assert.equal(metadata.programByteLength,tape.programData.length);
    assert.equal(metadata.autostartLine,20);assert.equal(metadata.target,'spectrum-48k');
    assert.equal(metadata.sourceUnits,'utf16-code-units');assert.equal(metadata.encodedUnits,'basic-program-bytes');
    const first=metadata.sourceMap[0];
    assert.equal(first.basicLineNumber,20);assert.equal(first.encodedOffset,0);
    assert.equal(first.statements[0].encodedRange.offset,4);
    assert.equal(metadata.source.positionAt(first.sourceRange.start).line,1);
    assert.match(metadata.source.textInRange(first.sourceRange),/^20 PRINT 1/);
    assert.throws(()=>{first.statements[0].encodedRange.offset=999;},TypeError);
    assert.throws(()=>{metadata.source.text='changed';},TypeError);
    assert.throws(()=>metadata.sourceMap.push(first),TypeError);
    const persisted=JSON.parse(await readFile(run.metadataPath,'utf8'));
    assert.deepEqual(persisted,JSON.parse(JSON.stringify(metadata)));
    assert.deepEqual(fake.launches[0].metadata,persisted,'Complete sidecar exists before backend launch');
    assert.strictEqual(coordinator.currentBuild,metadata);
    assert.strictEqual(coordinator.buildForSession(run.session.id),metadata);
    fake.launches[0].close();await run.session.finished;
    assert.equal(coordinator.currentBuild,undefined);
    assert.equal(coordinator.buildForSession(run.session.id),undefined);
    await assert.rejects(access(run.metadataPath),{code:'ENOENT'});
    assert.equal(metadata.source.text,text,'Historical facts survive sidecar cleanup');
  } finally {await coordinator.dispose();}
});
test('metadata bytes are deterministic while exact source changes invalidate eligibility permanently',async()=>{
  const fake=backend();const coordinator=new RunCoordinator(fake);
  try {
    const first=await coordinator.run(input());
    coordinator.observeSource({source:new SourceDocument('other.zxbas','10 STOP'),version:2});
    assert.strictEqual(coordinator.currentBuild,first.run.metadata,'Unrelated source observations do not invalidate');
    coordinator.observeSource(input(text.replace('PRINT','print'),1));
    assert.equal(coordinator.currentBuild,undefined);
    coordinator.observeSource(input());assert.equal(coordinator.currentBuild,undefined,'Undo cannot revalidate a historical revision');
    const second=await coordinator.run(input());assert.equal(second.kind,'success');
    assert.equal(first.run.buildId,second.run.buildId);
    assert.equal(fake.launches[0].metadataText,fake.launches[1].metadataText);
    assert.equal(coordinator.buildForSession(first.run.session.id),undefined);
    assert.strictEqual(coordinator.currentBuild,second.run.metadata);
    coordinator.invalidateSource(second.run.sourceId);
    coordinator.observeSource(input());
    assert.equal(coordinator.currentBuild,undefined,'Reopen with identical URI/version/text gets a new revision');
  } finally {await coordinator.dispose();}
});
test('a source edit during pending startup leaves owned execution with historical metadata only',async()=>{
  const fake=backend();const original=fake.launch.bind(fake);let release;let started;
  const gate=new Promise(resolve=>{release=resolve;});const entered=new Promise(resolve=>{started=resolve;});
  fake.launch=async(request)=>{started();await gate;return original(request);};
  const coordinator=new RunCoordinator(fake);
  try {
    const pending=coordinator.run(input());await entered;
    coordinator.observeSource(input('10 STOP',2));release();
    const result=await pending;assert.equal(result.kind,'success');
    assert.strictEqual(coordinator.active,result.run);assert.equal(result.run.metadata.source.text,text);
    assert.equal(coordinator.currentBuild,undefined);assert.equal(coordinator.buildForSession(result.run.session.id),undefined);
  } finally {release();await coordinator.dispose();}
});
