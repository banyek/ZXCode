import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {SourceDocument,checkProgram,writeBasicTap} from '../packages/core/dist/index.js';
import {correlateBasicDispatch,ORIGINAL_48K_ROM_SHA256,BasicDebugSession,startBasicDebugging} from '../packages/runner/dist/index.js';
import {createRunBuildMetadata} from '../packages/runner/dist/identity.js';
import {fakeDebugBackend} from './fixtures/runner/debug-machine.mjs';
function image(text='10 LET x=0: IF x=0 THEN GO TO 20\n20 STOP\n') {
 const source=new SourceDocument('debug.zxbas',text),compiled=checkProgram(source);assert.equal(compiled.kind,'success');
 const encoded=compiled.encodedProgram,tap=writeBasicTap(encoded.programBytes,{filenameBytes:new Uint8Array(10).fill(32),autostart:10,variablesOffset:encoded.programBytes.length});
 const metadata=createRunBuildMetadata(source,1,encoded,10,tap.tapBytes);
 return {metadata,image:Object.freeze({source,version:1,programBytes:Object.freeze(Array.from(encoded.programBytes)),sourceMap:metadata.sourceMap,buildId:metadata.buildId})};
}
test('production BASIC correlation requires exact current source, ROM, image and statement identity at relocated bases',()=>{
 const built=image(),data=built.image;
 for(const base of [23755,23819,24012])for(const line of data.sourceMap)for(const [index,statement] of line.statements.entries()) {
  const observation={stop:{sessionId:'test',epoch:1,sequence:1,reason:'breakpoint',pc:0x1b3d,breakpointIds:[]},romSha256:ORIGINAL_48K_ROM_SHA256,iy:0x5c3a,flags:128,line:line.basicLineNumber,statement:index+1,programBase:base,variablesAddress:base+data.programBytes.length,characterAddress:base+statement.encodedRange.offset,programBytes:data.programBytes};
  const current={source:data.source,version:1};const result=correlateBasicDispatch(data,observation,current);
  assert.equal(result.kind,'mapped');assert.deepEqual(result.location.sourceRange,statement.sourceRange);
  assert.equal(correlateBasicDispatch(data,observation,{source:new SourceDocument(data.source.id,data.source.text),version:1}).reason,'stale-source');
  for(const change of [{romSha256:'other'},{iy:0},{flags:0},{stop:{...observation.stop,pc:0x12ac}},{statement:index+2},{programBytes:[]},{characterAddress:base+statement.encodedRange.offset+1}])assert.equal(correlateBasicDispatch(data,{...observation,...change},current).kind,'unmapped');
 }
});
test('source breakpoint plans preserve physical rows and select exact executable statements without shifting blank lines',async()=>{
 const built=image('0010 LET x=0: IF x=0 THEN GO TO 20\n\n20 STOP\n');
 const machine=(await fakeDebugBackend().open({mode:'launch'})).value,stop=(await machine.pause()).value;
 const directory=await mkdtemp(join(tmpdir(),'zxcode-debug-plan-'));const session=new BasicDebugSession(built.image,built.metadata,machine,stop,directory,join(directory,'program.tap'));
 try {
  const column=built.image.source.text.indexOf('GO TO')+1;
  const planned=session.setBreakpoints([{line:1},{line:1,column},{line:2},{line:1,column:1}]);
  assert.equal(planned[0].message,'BASIC 10:1');assert.equal(planned[1].message,'BASIC 10:3');assert.equal(planned[2].verified,false);assert.equal(planned[3].verified,false);
  assert.ok(Object.isFrozen(planned));
  session.invalidateSource();assert.equal(session.currentLocation,undefined);assert.equal(session.state,'closed');
  assert.equal((await session.continue()).kind,'error');assert.equal(session.setBreakpoints([{line:1}])[0].verified,false);
 } finally {await session.close();}
 await assert.rejects(access(directory));
});
test('invalid and empty BASIC cannot launch a machine or invent debug line numbers',async()=>{
 let launches=0;const backend={id:'must-not-launch',async open(){launches++;throw new Error('unexpected launch');}};
 for(const text of ['PRINT 1\n','10 PRINT "\n',''])assert.equal((await startBasicDebugging({source:new SourceDocument('bad',text),version:1},backend)).kind,'error');
 assert.equal(launches,0);
});
