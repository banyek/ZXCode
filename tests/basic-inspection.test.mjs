import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inspectBasicVariables,readPausedMemory,ORIGINAL_48K_ROM_SHA256} from '../packages/runner/dist/index.js';
const fixture=JSON.parse(readFileSync(new URL('./fixtures/runtime-variables-rom.json',import.meta.url)));
function reader({changeStop=false,wrongRom=false,malformed=false}={}) {
 const stop=Object.freeze({sessionId:'coherent',epoch:1,sequence:1,reason:'breakpoint',pc:0x1b3d,breakpointIds:[]});let reads=0;
 const bytes=Uint8Array.from(Buffer.from(fixture.variablesHex,'hex'));if(malformed)bytes[0]=0;
 return {romSha256:wrongRom?'wrong':ORIGINAL_48K_ROM_SHA256,async inspect(request){
  const memory=(request.memory??[]).map(region=>{
   if(region.address===0x5c4b) {const values=new Uint8Array(16);for(const [at,value] of [[0,fixture.variablesAddress],[8,23755],[14,fixture.editLineAddress]]){values[at]=value&255;values[at+1]=value>>>8;}return {address:region.address,bytes:Array.from(values)};}
   return {address:region.address,bytes:Array.from(bytes.slice(0,region.length))};
  });reads++;return {kind:'success',value:{stop:changeStop&&reads>1?{...stop,sequence:2}:stop,registers:{},memory}};
 }};
}
test('coherent variable inspection decodes the independent table and preserves pause identity',async()=>{
 const result=await inspectBasicVariables(reader());assert.equal(result.kind,'success');assert.equal(result.value.table.kind,'decoded');assert.equal(result.value.variablesAddress,fixture.variablesAddress);assert.equal(result.value.table.variables[0].value,123);
});
test('semantic inspection refuses changed stops and wrong ROM while independent raw memory remains available',async()=>{
 assert.equal((await inspectBasicVariables(reader({changeStop:true}))).code,'stale-stop');
 const unknown=reader({wrongRom:true});assert.equal((await inspectBasicVariables(unknown)).code,'unsupported-operation');assert.equal((await readPausedMemory(unknown,0x8000,4)).kind,'success');
 const malformed=await inspectBasicVariables(reader({malformed:true}));assert.equal(malformed.kind,'success');assert.equal(malformed.value.table.kind,'unsupported');
 assert.equal((await readPausedMemory(reader(),65535,2)).code,'invalid-request');
});
