import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:net';
import {createZrcpBackend} from '../packages/runner/dist/index.js';
import {ZrcpTransport} from '../packages/runner/dist/zrcp-transport.js';
async function fakeServer({badMemory=false,hangMemory=false,version='13.0'}={}) {
 const sockets=new Set(),commands=[];let pc=0x8000,paused=false;
 const registers=()=>`PC=${pc.toString(16).padStart(4,'0')} SP=ffff AF=0000 BC=0000 DE=0000 HL=0000 IX=0000 IY=5c3a AF'=0000 BC'=0000 DE'=0000 HL'=0000 I=00 R=00 IM1`;
 const server=createServer(socket=>{
  sockets.add(socket);socket.on('error',()=>{});socket.on('close',()=>sockets.delete(socket));
  const reply=body=>{const value=body+`\ncommand${paused?'@cpu-step':''}> `;const split=Math.floor(value.length/2);socket.write(value.slice(0,split));setImmediate(()=>{if(!socket.destroyed)socket.write(value.slice(split));});};
  reply('Welcome');let input='';socket.on('data',data=>{
   input+=data.toString();let index;
   while((index=input.indexOf('\n'))>=0) {
    const command=input.slice(0,index);input=input.slice(index+1);commands.push(command);
    if(command==='get-version')reply(version);
    else if(command==='enter-cpu-step'){paused=true;reply('');}
    else if(command==='exit-cpu-step'){paused=false;reply('');}
    else if(command==='set-memory-zone -1')reply('');
    else if(command==='get-registers')reply(registers());
    else if(command==='cpu-step'){pc=(pc+1)&65535;reply(registers());}
    else if(command==='run 10000'){pc=(pc+10)&65535;reply('Returning after 10000 opcodes\n'+registers());}
    else if(command.startsWith('read-memory ')) {
     if(hangMemory)continue;
     const [,address,length]=command.split(' ').map(Number);reply(badMemory?'00':Buffer.from(Array.from({length},(_,i)=>(address+i)&255)).toString('hex'));
    } else reply('Error. Unexpected command');
   }
  });
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 return {port:server.address().port,commands,disconnect(){for(const socket of sockets)socket.destroy();},async close(){for(const socket of sockets)socket.destroy();await new Promise(resolve=>server.close(resolve));}};
}
test('ZRCP attach handles fragmented prompts, negotiates weak capabilities and enforces coherent leases',async()=>{
 const server=await fakeServer();let machine;
 try {
  const result=await createZrcpBackend({attachPort:server.port}).open({mode:'attach',requiredFeatures:['memory-read']});assert.equal(result.kind,'success');machine=result.value;
  assert.equal(machine.ownership,'attached');assert.ok(!machine.capabilities.features.includes('breakpoints'));
  const stop=(await machine.pause()).value;assert.strictEqual((await machine.pause()).value,stop);
  const read=await machine.inspect(stop,{registers:['PC','IY'],memory:[{address:0,length:4}]});assert.equal(read.kind,'success');assert.deepEqual(read.value.memory[0].bytes,[0,1,2,3]);assert.ok(Object.isFrozen(read.value.memory[0].bytes));
  assert.equal((await machine.inspect({...stop},{})).code,'stale-stop');
  assert.equal((await machine.inspect(undefined,{})).code,'stale-stop');
  assert.equal((await machine.inspect(stop,{memory:[{address:65535,length:2}]})).code,'invalid-request');
  assert.equal((await machine.writeMemory(stop,{address:32768,bytes:[1]})).code,'unsupported-operation');
  assert.equal((await machine.addBreakpoint(stop,{address:0x1b3d})).code,'unsupported-operation');
  const stepped=(await machine.step(stop)).value;assert.equal(stepped.pc,0x8001);assert.equal((await machine.inspect(stop,{})).code,'stale-stop');
  await machine.resume(stepped);assert.equal((await machine.inspect(stepped,{})).code,'stale-stop');
  const paused=(await machine.pause()).value;assert.ok(paused.sequence>stepped.sequence);
  const closing=machine.close();assert.strictEqual(machine.close(),closing);assert.equal((await closing).kind,'success');assert.equal((await machine.finished).phase,'closed');
  assert.ok(!server.commands.includes('exit-emulator'),'Attach never terminates another process');
 } finally {await machine?.close();await server.close();}
});
test('ZRCP wrong dialect, malformed responses and command deadlines fail without false paused state',async()=>{
 for(const options of [{version:'12.0'},{badMemory:true},{hangMemory:true}]) {
  const server=await fakeServer(options);let machine;
  try {
   const result=await createZrcpBackend({attachPort:server.port,commandTimeoutMs:100}).open({mode:'attach'});
   if(options.version) {assert.equal(result.code,'unsupported-operation');continue;}
   assert.equal(result.kind,'success');machine=result.value;
   const stop=(await machine.pause()).value;
   const read=await machine.inspect(stop,{memory:[{address:0,length:4}]});
   assert.equal(read.code,options.hangMemory?'timeout':'protocol-error');
   assert.equal((await machine.finished).phase,'disconnected');assert.equal(machine.phase,'disconnected');
   await machine.close();assert.equal(machine.phase,'disconnected');
  } finally {await machine?.close();await server.close();}
 }
});
test('ZRCP cancellation before execution preserves state; cancellation during a command disconnects',async()=>{
 const server=await fakeServer({hangMemory:true});let machine;
 try {
  machine=(await createZrcpBackend({attachPort:server.port}).open({mode:'attach'})).value;
  const stop=(await machine.pause()).value, cancelled=new AbortController();cancelled.abort();
  assert.equal((await machine.resume(stop,{signal:cancelled.signal})).code,'cancelled');assert.equal(machine.phase,'paused');
  const abort=new AbortController();const pending=machine.inspect(stop,{memory:[{address:0,length:4}]},{signal:abort.signal});
  const deadline=Date.now()+1000;
  while(!server.commands.some(command=>command.startsWith('read-memory')) && Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,1));
  assert.ok(server.commands.some(command=>command.startsWith('read-memory')));
  abort.abort();assert.equal((await pending).code,'cancelled');assert.equal((await machine.finished).phase,'disconnected');
 } finally {await machine?.close();await server.close();}
});
test('ZRCP rejects invalid config and protocol command injection before sending',async()=>{
 assert.equal((await createZrcpBackend({attachPort:0}).open({mode:'attach'})).code,'invalid-request');
 assert.equal((await createZrcpBackend({}).open({mode:'launch'})).kind,'error');
 assert.equal((await createZrcpBackend({executable:process.execPath}).open({mode:'launch'})).code,'unsupported-operation');
 assert.equal((await createZrcpBackend({}).open({mode:'typo'})).code,'invalid-request');
 const server=await fakeServer();let transport;
 try {transport=await ZrcpTransport.connect(server.port,'command',1000);await assert.rejects(transport.command('get-version\nreset-cpu'),/line breaks/);assert.deepEqual(server.commands,[]);}
 finally {transport?.close();await server.close();}
});

test('ZRCP idle disconnect invalidates the session and reconnect creates a fresh identity',async()=>{
 const server=await fakeServer();const backend=createZrcpBackend({attachPort:server.port});let machine;
 try {
  machine=(await backend.open({mode:'attach'})).value;const original=machine;const stop=(await original.pause()).value;
  server.disconnect();assert.equal((await original.finished).phase,'disconnected');
  machine=(await backend.open({mode:'attach'})).value;assert.notEqual(machine.id,original.id);
  assert.equal((await machine.inspect(stop,{})).code,'stale-stop');
  assert.equal((await machine.pause()).kind,'success');
 } finally {await machine?.close();await server.close();}
});
