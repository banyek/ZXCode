import test from 'node:test';
import assert from 'node:assert/strict';
import {fakeDebugBackend} from './fixtures/runner/debug-machine.mjs';
const opened=async options=>{const result=await fakeDebugBackend(options).open({mode:'launch'});assert.equal(result.kind,'success');return result.value;};
test('portable machine test backend negotiates weaker features without claiming unsupported operations',async()=>{
 const weak=fakeDebugBackend({features:['pause','resume']});
 assert.equal((await weak.open({mode:'launch',requiredFeatures:['memory-read']})).code,'unsupported-operation');
 const {value:machine}=await weak.open({mode:'attach'});assert.equal(machine.ownership,'attached');
 const stop=(await machine.pause()).value;
 assert.equal((await machine.inspect(stop,{memory:[{address:0,length:1}]})).code,'unsupported-operation');
 assert.equal((await machine.step(stop)).code,'unsupported-operation');
 await machine.close();assert.equal((await machine.finished).phase,'closed');
});
test('coherent machine inspections own immutable bytes and exact stop leases',async()=>{
 const machine=await opened();let stop=(await machine.pause()).value;
 assert.strictEqual((await machine.pause()).value,stop);
 assert.equal((await machine.inspect({...stop},{registers:['PC']})).code,'stale-stop');
 const written=await machine.writeMemory(stop,{address:0x8000,bytes:[42,43]});assert.equal(written.kind,'success');
 assert.equal((await machine.inspect(stop,{})).code,'stale-stop');stop=written.value;
 const inspected=(await machine.inspect(stop,{registers:['PC'],memory:[{address:0x8000,length:2}]})).value;
 assert.strictEqual(inspected.stop,stop);assert.deepEqual(inspected.memory[0].bytes,[42,43]);assert.ok(Object.isFrozen(inspected.memory[0].bytes));
 assert.equal((await machine.inspect(stop,{memory:[{address:65535,length:2}]})).code,'invalid-request');
 await machine.resume(stop);assert.equal((await machine.inspect(stop,{})).code,'stale-stop');
 const next=(await machine.pause()).value;assert.ok(next.sequence>stop.sequence);
 const reset=(await machine.reset(next)).value;assert.ok(reset.epoch>next.epoch);assert.equal(reset.pc,0);
 assert.deepEqual(inspected.memory[0].bytes,[42,43]);await machine.close();
});
test('machine breakpoint IDs are session-owned and event subscriptions cannot corrupt lifecycle',async()=>{
 const machine=await opened(),events=[];
 const unsubscribe=machine.subscribe(event=>events.push(event));machine.subscribe(()=>{throw new Error('listener');});
 const stop=(await machine.pause()).value;
 const breakpoint=(await machine.addBreakpoint(stop,{address:0x8001})).value;
 assert.equal((await machine.removeBreakpoint(stop,'another-session-bp')).code,'invalid-request');
 const hit=(await machine.step(stop)).value;assert.equal(hit.reason,'breakpoint');assert.deepEqual(hit.breakpointIds,[breakpoint.id]);
 assert.equal((await machine.removeBreakpoint(hit,breakpoint.id)).kind,'success');
 const abort=new AbortController();abort.abort();assert.equal((await machine.resume(hit,{signal:abort.signal})).code,'cancelled');
 unsubscribe();await machine.close();await machine.close();assert.equal((await machine.finished).phase,'closed');assert.equal((await machine.pause()).code,'invalid-state');
 assert.equal(events.filter(event=>event.kind==='stopped').length,2);
});
