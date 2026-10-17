import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync,existsSync} from 'node:fs';
import {copyFile} from 'node:fs/promises';
import {join,isAbsolute} from 'node:path';
import {SourceDocument} from '../../packages/core/dist/index.js';
import {startBasicDebugging,createZrcpBackend} from '../../packages/runner/dist/index.js';
const args=process.argv.slice(2),options=new Map();for(let i=0;i<args.length;i+=2)options.set(args[i],args[i+1]);
const executable=options.get('--executable'),output=options.get('--output-dir');assert.ok(executable&&output&&isAbsolute(executable)&&isAbsolute(output));mkdirSync(output,{recursive:false});
const source=new SourceDocument('runtime-dispatch.zxbas',readFileSync(new URL('../../examples/debug/runtime-dispatch.zxbas',import.meta.url),'utf8'));
const backend=createZrcpBackend({executable});let session;
const unwrap=result=>{assert.equal(result.kind,'success',JSON.stringify(result));return result.value;};
const waitEvent=()=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>{off();reject(new Error('BASIC source-stop deadline'));},15000);const off=session.subscribe(event=>{if(event.kind==='stopped'||event.kind==='terminated'){clearTimeout(timer);off();resolve(event);}});});
try {
 session=unwrap(await startBasicDebugging({source,version:1},backend));
 await copyFile(session.artifactPath,join(output,'debug-program.tap'));
 const lines=source.text.split('\n');
 const requests=[{line:2},{line:2,column:lines[1].indexOf('GO SUB')+1},{line:2,column:lines[1].indexOf('LET')+1},{line:3,column:lines[2].indexOf('LET')+1},{line:5},{line:6,column:lines[5].indexOf('RETURN')+1},{line:7,column:lines[6].indexOf('STOP')+1}];
 const bindings=session.setBreakpoints(requests);assert.ok(bindings.every(item=>item.verified));
 const stops=[];let next=waitEvent();unwrap(await session.begin(true));
 while(true) {
  const event=await next;if(event.kind==='terminated')break;
  assert.ok(event.location,event.message);const location=event.location;
  stops.push({line:location.basicLine,statement:location.statement,sourceRange:location.sourceRange,position:location.position,text:source.textInRange(location.sourceRange)});
  next=waitEvent();unwrap(await session.continue());
 }
 assert.deepEqual(stops.map(stop=>[stop.line,stop.statement]),[[10,1],[20,1],[20,2],[100,2],[20,3],[20,1],[30,2],[50,1]]);
 assert.equal(existsSync(session.artifactPath),false);
 session=unwrap(await startBasicDebugging({source,version:2},backend));next=waitEvent();unwrap(await session.begin());assert.equal((await next).kind,'stopped');
 const stalePath=session.artifactPath;session.invalidateSource();assert.equal(session.currentLocation,undefined);assert.equal(session.state,'closed');assert.equal((await session.continue()).kind,'error');unwrap(await session.close());assert.equal(existsSync(stalePath),false);
 writeFileSync(join(output,'report.json'),JSON.stringify({schemaVersion:1,status:'passed',backend:'real loopback ZRCP/original 48K ROM',verified:['cold-boot native TAP smartload','loader/parser hits not shown as source','entry stop','line and IF-tail statement breakpoints','GO SUB/RETURN continuation','two loop iterations','unexecuted false IF-tail breakpoint not hit','report completion cleanup','source invalidation terminates and cleans'],stops},null,2)+'\n');
 console.log('Verified actual BASIC source breakpoints across IF/loops/GO SUB/RETURN, false hits and stale-source cleanup');
} finally {await session?.close();}
