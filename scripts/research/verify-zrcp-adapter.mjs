import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {dirname} from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import {join,isAbsolute} from 'node:path';
import {createZrcpBackend} from '../../packages/runner/dist/index.js';
const args=process.argv.slice(2),options=new Map();
for(let i=0;i<args.length;i+=2)options.set(args[i],args[i+1]);
const executable=options.get('--executable'),snapshot=options.get('--snapshot'),output=options.get('--output-dir');
assert.ok(executable&&snapshot&&output&&[executable,snapshot,output].every(isAbsolute),'Use --executable, --snapshot and --output-dir with absolute paths');
mkdirSync(output,{recursive:false});
const unwrap=result=>{assert.equal(result.kind,'success',JSON.stringify(result));return result.value;};
const backend=createZrcpBackend({executable});let machine,attachedProcess,attachedClosed;
try {
 machine=unwrap(await backend.open({mode:'launch',requiredFeatures:['memory-read','breakpoints','load-z80']}));
 let stop=unwrap(await machine.pause());
 const rom=unwrap(await machine.inspect(stop,{memory:[{address:0,length:16384}]})).memory[0].bytes;
 const romSha256=createHash('sha256').update(Buffer.from(rom)).digest('hex');assert.equal(romSha256,'d55daa439b673b0e3f5897f99ac37ecb45f974d1862b4dadb85dec34af99cb42');
 stop=unwrap(await machine.writeMemory(stop,{address:0x8000,bytes:[0,0,60,195,0,128]}));
 stop=unwrap(await machine.writeRegisters(stop,{PC:0x8000}));
 const breakpoint=unwrap(await machine.addBreakpoint(stop,{address:0x8001}));
 const waitStop=()=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>{unsubscribe();reject(new Error('Machine breakpoint deadline'));},5000);const unsubscribe=machine.subscribe(event=>{if(event.kind==='stopped'){clearTimeout(timer);unsubscribe();resolve(event.stop);}});});
 let stopped=waitStop();unwrap(await machine.resume(stop));stop=await stopped;
 assert.equal(stop.reason,'breakpoint');assert.equal(stop.pc,0x8001);assert.deepEqual(stop.breakpointIds,[breakpoint.id]);
 const old=stop;stop=unwrap(await machine.step(stop));assert.equal(stop.pc,0x8002);assert.equal((await machine.inspect(old,{})).code,'stale-stop');
 unwrap(await machine.removeBreakpoint(stop,breakpoint.id));
 const beforeLoad=stop;stop=unwrap(await machine.load(stop,{format:'z80',path:snapshot}));assert.ok(stop.epoch>beforeLoad.epoch);
 const dispatch=unwrap(await machine.addBreakpoint(stop,{address:0x1b3d}));stopped=waitStop();unwrap(await machine.resume(stop));stop=await stopped;
 const state=unwrap(await machine.inspect(stop,{registers:['PC','IY'],memory:[{address:0x5c45,length:3}]}));
 assert.equal(state.registers.PC,0x1b3d);assert.equal(state.registers.IY,0x5c3a);assert.deepEqual(state.memory[0].bytes,[10,0,1]);
 unwrap(await machine.removeBreakpoint(stop,dispatch.id));stop=unwrap(await machine.reset(stop));assert.equal(stop.pc,0);
 const firstId=machine.id;unwrap(await machine.close());assert.equal((await machine.finished).phase,'closed');
 machine=unwrap(await backend.open({mode:'launch'}));assert.notEqual(machine.id,firstId);assert.equal((await machine.inspect(stop,{})).code,'stale-stop');unwrap(await machine.close());
 const stock=options.get('--without-loopback-option');
 if(stock) assert.equal((await createZrcpBackend({executable:stock}).open({mode:'launch'})).code,'unsupported-operation');
 const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const port=server.address().port;await new Promise(resolve=>server.close(resolve));
 attachedProcess=spawn(executable,['--noconfigfile','--no-saveconf-on-exit','--machine','48k','--vo','null','--ao','null','--nowelcomemessage','--nosplash','--stats-send-already-asked','--stats-disable-check-updates','--stats-disable-check-yesterday-users','--remoteprotocol-loopback-only','--enable-remoteprotocol','--remoteprotocol-port',String(port),'--remoteprotocol-prompt','zxcode-attach'],{cwd:dirname(executable),stdio:'ignore',shell:false});
 attachedClosed=new Promise(resolve=>attachedProcess.once('close',resolve));
 const attachedBackend=createZrcpBackend({attachPort:port,attachPrompt:'zxcode-attach'});
 let attached;
 for(let attempt=0;attempt<100;attempt++) {
  const result=await attachedBackend.open({mode:'attach'});
  if(result.kind==='success'){attached=result.value;break;}
  assert.equal(attachedProcess.exitCode,null);assert.equal(attachedProcess.signalCode,null);await new Promise(resolve=>setTimeout(resolve,25));
 }
 assert.ok(attached,'Actual attach listener ready');machine=attached;
 let attachedStop=unwrap(await machine.pause());const attachedPc=attachedStop.pc;
 assert.equal((await machine.reset(attachedStop)).code,'unsupported-operation');const attachedId=machine.id;
 unwrap(await machine.close());assert.equal(attachedProcess.exitCode,null,'Attach close preserves external process');
 machine=unwrap(await attachedBackend.open({mode:'attach'}));assert.notEqual(machine.id,attachedId);attachedStop=unwrap(await machine.pause());assert.equal(attachedStop.pc,attachedPc,'Paused attach close preserves machine state');
 unwrap(await machine.close());attachedProcess.kill('SIGTERM');await attachedClosed;attachedProcess=undefined;
 writeFileSync(join(output,'report.json'),JSON.stringify({schemaVersion:1,status:'passed',backend:'portable @zxcode/runner ZRCP adapter',romSha256,verified:['owned loopback launch','coherent ROM read','verified RAM/register write','asynchronous machine breakpoint','machine step','stale-stop refusal','Z80 snapshot load epoch','original-ROM BASIC dispatch state','reset','owned close','fresh restart identity','weaker actual attach','attach detach preserves process and paused state','fresh attach identity'],normalRun:'separate unchanged Fuse backend'},null,2)+'\n');
 console.log('Verified real portable ZRCP adapter lifecycle, breakpoints, memory/registers, snapshot dispatch and restart');
} finally {await machine?.close();if(attachedProcess) {if(attachedProcess.exitCode===null && attachedProcess.signalCode===null)attachedProcess.kill('SIGKILL');await attachedClosed;}}
