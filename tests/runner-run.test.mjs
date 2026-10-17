import assert from 'node:assert/strict';
import {access,mkdtemp,readFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname,join} from 'node:path';
import test from 'node:test';
import {buildTap,readBasicTap,SourceDocument} from '../packages/core/dist/index.js';
import {RunCoordinator} from '../packages/runner/dist/index.js';
function backend() {
  const launches=[];const events=[];
  return {id:'fixture',capabilities:{transport:'external-process',formats:['tap'],targets:['spectrum-48k'],features:['stop']},launches,events,
    async launch(request) {
      const bytes=await readFile(request.artifact.path);
      let state='running';let finish;
      const finished=new Promise(resolve=>{finish=resolve;});
      const index=launches.length;
      const close=()=>{state='exited';finish({state:'exited',code:0,signal:null});};
      const session={id:`session-${index}`,backendId:'fixture',artifact:request.artifact,get state(){return state;},finished,
        async stop(){events.push(`stop-${index}`);state='stopped';finish({state:'stopped',code:0,signal:null});return {kind:'success'};}};
      launches.push({request,bytes,session,close});events.push(`launch-${index}`);
      return {kind:'success',session};
    }};
}
const source=(text='100 STOP\n20 PRINT "first"',version=1)=>({source:new SourceDocument('file:///sample.zxbas',text),version});
test('run uses shared program bytes with explicit lowest-line autostart and owns temporary artifact until exit',async()=>{
  const fake=backend();const coordinator=new RunCoordinator(fake);
  try {
    const input=source();
    const result=await coordinator.run(input);
    assert.equal(result.kind,'success');
    const launched=fake.launches[0];
    const tape=readBasicTap(launched.bytes);
    assert.equal(tape.kind,'success');assert.equal(tape.autostartLine,20);
    const normal=buildTap(input.source,{filenameBytes:new Uint8Array(10).fill(32),autostart:0x8000});
    assert.equal(normal.kind,'success');
    const normalTape=readBasicTap(normal.tap.tapBytes);
    assert.deepEqual(tape.programData,normalTape.programData);
    assert.equal(result.run.sourceId,input.source.id);assert.equal(result.run.version,1);
    assert.equal(result.run.buildId,launched.request.artifact.buildId);
    assert.ok(Object.isFrozen(result.run));assert.strictEqual(coordinator.active,result.run);
    await access(launched.request.artifact.path);
    launched.close();await result.run.session.finished;
    await assert.rejects(access(dirname(launched.request.artifact.path)),{code:'ENOENT'});
    assert.equal(coordinator.active,undefined);
  } finally {await coordinator.dispose();}
});
test('failed build and empty program never launch or stop the active run',async()=>{
  const fake=backend();const coordinator=new RunCoordinator(fake);
  try {
    const first=await coordinator.run(source());assert.equal(first.kind,'success');
    const broken=await coordinator.run(source('10 PRINT AT 10,',2));
    assert.equal(broken.kind,'build-error');assert.ok(broken.diagnostics.some(d=>d.code==='ZX1101'));
    assert.equal((await coordinator.run(source('',3))).failure.code,'invalid-request');
    assert.equal(fake.launches.length,1);assert.deepEqual(fake.events,['launch-0']);
    assert.strictEqual(coordinator.active,first.run);
  } finally {await coordinator.dispose();}
});
test('valid replacement stages distinct artifacts, stops old session and preserves deterministic build identity',async()=>{
  const fake=backend();const coordinator=new RunCoordinator(fake);
  try {
    const first=await coordinator.run(source());const second=await coordinator.run(source());
    assert.equal(first.kind,'success');assert.equal(second.kind,'success');
    assert.deepEqual(fake.events,['launch-0','stop-0','launch-1']);
    assert.notEqual(first.run.session.artifact.path,second.run.session.artifact.path);
    assert.equal(first.run.buildId,second.run.buildId);
    assert.deepEqual(fake.launches[0].bytes,fake.launches[1].bytes);
    await assert.rejects(access(first.run.session.artifact.path),{code:'ENOENT'});
    const changed=await coordinator.run(source('100 STOP\n20 PRINT "first"',2));
    assert.notEqual(changed.run.buildId,second.run.buildId);
  } finally {await coordinator.dispose();}
});
test('obsolete queued requests are skipped and dispose prevents further launches',async()=>{
  const fake=backend();const coordinator=new RunCoordinator(fake);
  const old=coordinator.run(source('10 STOP',1));const latest=coordinator.run(source('20 STOP',2));
  assert.equal((await old).failure.code,'cancelled');
  assert.equal((await latest).kind,'success');assert.equal(fake.launches.length,1);
  const artifact=fake.launches[0].request.artifact.path;
  assert.deepEqual(await coordinator.dispose(),{kind:'success'});
  await assert.rejects(access(artifact),{code:'ENOENT'});
  assert.equal((await coordinator.run(source())).failure.code,'cancelled');
});
test('launch and staging failures are surfaced and remove unpublished artifacts',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'zxcode-run-failure-'));
  const fake=backend();fake.launch=async()=>({kind:'error',code:'not-found',message:'Install emulator'});
  const coordinator=new RunCoordinator(fake,directory);
  try {
    const failed=await coordinator.run(source());assert.equal(failed.kind,'error');assert.equal(failed.failure.code,'not-found');
    assert.deepEqual(await readdir(directory),[]);
    const missing=new RunCoordinator(fake,join(directory,'absent'));
    const io=await missing.run(source());assert.equal(io.kind,'error');assert.match(io.failure.message,/prepare or launch/);
    assert.deepEqual(await readdir(directory),[]);
  } finally {await coordinator.dispose();await rm(directory,{recursive:true,force:true});}
});
test('failed replacement stop retains the owned session and rejects another launch',async()=>{
  const fake=backend();const coordinator=new RunCoordinator(fake);
  try {
    const first=await coordinator.run(source());assert.equal(first.kind,'success');
    fake.launches[0].session.stop=async()=>({kind:'error',code:'runtime-failed',message:'Close manually'});
    const next=await coordinator.run(source('10 STOP',2));
    assert.equal(next.kind,'error');assert.equal(next.failure.message,'Close manually');
    assert.equal(fake.launches.length,1);assert.strictEqual(coordinator.active,first.run);
    await access(first.run.session.artifact.path);
    fake.launches[0].close();await first.run.session.finished;
  } finally {await coordinator.dispose();}
});
test('a newer valid request cancels in-flight startup and cleans its unpublished tape',async()=>{
  const fake=backend();const immediate=fake.launch.bind(fake);let started;let first=true;
  const pendingStart=new Promise(resolve=>{started=resolve;});
  fake.launch=async(request,options)=>{
    if(!first) return immediate(request,options);
    first=false;started(request.artifact.path);
    return await new Promise(resolve=>options.signal.addEventListener('abort',()=>resolve({kind:'error',code:'cancelled',message:'Cancelled probe'}),{once:true}));
  };
  const coordinator=new RunCoordinator(fake);
  try {
    const old=coordinator.run(source());const oldPath=await pendingStart;
    const next=coordinator.run(source('10 STOP',2));
    assert.equal((await old).failure.code,'cancelled');
    assert.equal((await next).kind,'success');
    await assert.rejects(access(oldPath),{code:'ENOENT'});
    assert.equal(fake.launches.length,1);
  } finally {await coordinator.dispose();}
});
test('configuration selects a captured backend per valid request without replacing the coordinator',async()=>{
  const first=backend();const second=backend();const coordinator=new RunCoordinator(first);
  try {
    const original=await coordinator.run(source());assert.equal(original.kind,'success');
    const invalid=await coordinator.run({...source('10 PRINT AT 10,',2),backend:second});
    assert.equal(invalid.kind,'build-error');assert.equal(second.launches.length,0);
    assert.strictEqual(coordinator.active,original.run);
    const replacement=await coordinator.run({...source('20 STOP',3),backend:second});
    assert.equal(replacement.kind,'success');assert.equal(second.launches.length,1);
    assert.deepEqual(first.events,['launch-0','stop-0']);
  } finally {await coordinator.dispose();}
});
