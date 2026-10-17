import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,mkdirSync,writeFileSync,existsSync} from 'node:fs';
import {join,isAbsolute} from 'node:path';
import {SourceDocument} from '../../packages/core/dist/index.js';
import {startBasicDebugging,createZrcpBackend,inspectBasicVariables,readPausedMemory,selectBasicWatch} from '../../packages/runner/dist/index.js';
const args=process.argv.slice(2),options=new Map();for(let i=0;i<args.length;i+=2)options.set(args[i],args[i+1]);
const executable=options.get('--executable'),output=options.get('--output-dir');assert.ok(executable&&output&&isAbsolute(executable)&&isAbsolute(output));mkdirSync(output,{recursive:false});
const source=new SourceDocument('runtime-dispatch.zxbas',readFileSync(new URL('../../examples/debug/runtime-dispatch.zxbas',import.meta.url),'utf8'));
const backend=createZrcpBackend({executable});let session;
const unwrap=result=>{assert.equal(result.kind,'success',JSON.stringify(result));return result.value;};
const waitEvent=()=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>{off();reject(new Error('BASIC step deadline'));},15000);const off=session.subscribe(event=>{if(event.kind==='stopped'||event.kind==='terminated'){clearTimeout(timer);off();resolve(event);}});});
// Independently observed original-ROM trace in designs 061/064, not lexical ordering.
const reference=JSON.parse(readFileSync(new URL('../../docs/evidence/m8-runtime-dispatch.json',import.meta.url)));
assert.equal(createHash('sha256').update(source.text).digest('hex'),reference.sourceSha256);
const expected=reference.trace.dispatch.map(item=>[item.line,item.statement]);assert.equal(expected.length,17);
try {
 session=unwrap(await startBasicDebugging({source,version:1},backend));
 assert.equal((await session.stepStatement()).kind,'error');
 let next=waitEvent();unwrap(await session.begin());const stops=[];let originalMachine;
 for(let index=0;index<expected.length;index++) {
  const event=await next;assert.equal(event.kind,'stopped');assert.ok(event.location,event.message);
  assert.equal(event.reason,index===0?'entry':'step');stops.push([event.location.basicLine,event.location.statement]);
  assert.deepEqual(stops.at(-1),expected[index]);
  if(index>0) {const vars=unwrap(await inspectBasicVariables(session));assert.ok(Number.isFinite(Number(selectBasicWatch(vars,'total').display)));}
  const screen=unwrap(await readPausedMemory(session,0x4000,6912));assert.equal(screen.memory[0].bytes.length,6912);originalMachine??=screen.stop.sessionId;
  next=waitEvent();unwrap(await session.stepStatement());
 }
 assert.equal((await next).kind,'terminated');assert.equal(existsSync(session.artifactPath),false);
 // Cold reset: a fresh owned machine starts at entry, not the previous STOP.
 const oldArtifact=session.artifactPath;session=unwrap(await startBasicDebugging({source,version:1},backend));
 next=waitEvent();unwrap(await session.begin());const reset=await next;assert.deepEqual([reset.location.basicLine,reset.location.statement],[10,1]);assert.notEqual(session.artifactPath,oldArtifact);assert.notEqual(unwrap(await session.inspect({})).stop.sessionId,originalMachine);
 const binding=session.setBreakpoints([{line:2,column:source.text.split('\n')[1].indexOf('GO SUB')+1}]);assert.equal(binding[0].verified,true);
 next=waitEvent();unwrap(await session.continue());const hit=await next;assert.deepEqual([hit.location.basicLine,hit.location.statement],[20,2]);assert.equal(hit.reason,'breakpoint');
 const vars=unwrap(await inspectBasicVariables(session));assert.equal(selectBasicWatch(vars,'total').display,'0');
 next=waitEvent();unwrap(await session.stepStatement());const into=await next;assert.deepEqual([into.location.basicLine,into.location.statement],[100,1]);assert.equal(into.reason,'step');
 session.setBreakpoints([]);next=waitEvent();unwrap(await session.continue());assert.equal((await next).kind,'terminated');
 writeFileSync(join(output,'report.json'),JSON.stringify({schemaVersion:1,status:'passed',backend:'real loopback ZRCP/original 48K ROM',verified:['17 independently observed BASIC dispatches','colon/IF/loops/GO SUB/RETURN','exact stored watch and screen reads while stepping','report completion without fabricated source stop','cold reset creates a new owned build at entry','breakpoint/inspect/step into/continue'],stops},null,2)+'\n');
 console.log('Verified real BASIC statement stepping and cold reset acceptance');
} finally {await session?.close();}
