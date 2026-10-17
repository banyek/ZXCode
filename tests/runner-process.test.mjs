import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
import {startExternalProcess} from '../packages/runner/dist/index.js';
const fixture=fileURLToPath(new URL('./fixtures/runner/process.mjs',import.meta.url));
const artifact={path:'/build/fixture.tap',format:'tap',target:'spectrum-48k',buildId:'fixture-build'};
const launch=(mode,extra=[],options={})=>startExternalProcess(artifact,{backendId:'fixture',executable:process.execPath,arguments:[fixture,mode,...extra],stopGraceMs:200},options);
test('external process completion retains immutable artifact identity and zero exit',async()=>{
  const result=await launch('success');
  assert.equal(result.kind,'success');
  assert.deepEqual(result.session.artifact,artifact);
  assert.ok(Object.isFrozen(result.session.artifact));
  const exit=await result.session.finished;
  assert.deepEqual(exit,{state:'exited',code:0,signal:null});
  assert.equal(result.session.state,'exited');
  assert.deepEqual(await result.session.stop(),{kind:'success'});
});
test('nonzero emulator exit exposes bounded stderr as structured runtime failure',async()=>{
  const result=await launch('failure');
  assert.equal(result.kind,'success');
  const exit=await result.session.finished;
  assert.equal(exit.state,'failed');
  assert.equal(exit.code,7);
  assert.equal(exit.failure.code,'runtime-failed');
  assert.match(exit.failure.message,/fixture runtime failure/);
  assert.equal(result.session.state,'failed');
});
test('stop is idempotent and completion is terminal',async()=>{
  const result=await launch('stay');
  assert.equal(result.kind,'success');
  const first=result.session.stop();
  assert.strictEqual(result.session.stop(),first);
  assert.deepEqual(await first,{kind:'success'});
  assert.equal((await result.session.finished).state,'stopped');
  assert.equal(result.session.state,'stopped');
});
test('stop falls back to forced termination when a running process ignores SIGTERM',{skip:process.platform==='win32'},async()=>{
  const directory=await mkdtemp(join(tmpdir(),'zxcode-process-'));
  let session;
  try {
    const ready=join(directory,'ready');
    const result=await launch('ignore-stop',[ready]);
    assert.equal(result.kind,'success');session=result.session;
    const deadline=Date.now()+3000;
    while(Date.now()<deadline) {try {await readFile(ready);break;} catch {await new Promise((resolve)=>setTimeout(resolve,10));}}
    assert.equal(await readFile(ready,'utf8'),'ready');
    assert.deepEqual(await session.stop(),{kind:'success'});
    assert.equal((await session.finished).signal,'SIGKILL');
  } finally {await session?.stop();await rm(directory,{recursive:true,force:true});}
});
test('startup cancellation is explicit and delivered sessions survive later cancellation',async()=>{
  const before=new AbortController();before.abort();
  assert.equal((await launch('stay',[],{signal:before.signal})).code,'cancelled');
  const during=new AbortController();
  const pending=launch('stay',[],{signal:during.signal});during.abort();
  assert.equal((await pending).code,'cancelled');
  const after=new AbortController();
  const result=await launch('stay',[],{signal:after.signal});
  assert.equal(result.kind,'success');
  after.abort();
  assert.equal(result.session.state,'running');
  await result.session.stop();
  assert.equal((await result.session.finished).state,'stopped');
});
test('startup executable errors remain structured launch failures',async()=>{
  const result=await startExternalProcess(artifact,{backendId:'missing',executable:join(tmpdir(),'zxcode-nonexistent-executable'),arguments:[]});
  assert.equal(result.kind,'error');
  assert.equal(result.code,'launch-failed');
  assert.match(result.message,/Could not start missing/);
});
