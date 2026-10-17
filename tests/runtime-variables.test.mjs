import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {decodeBasicVariables,displayRuntimeString,readSpectrumNumber} from '../packages/core/dist/index.js';
const fixture=JSON.parse(readFileSync(new URL('./fixtures/runtime-variables-rom.json',import.meta.url)));
const original=()=>Buffer.from(fixture.variablesHex,'hex');
test('runtime variables match independently produced original-ROM scalar, array and active FOR state',()=>{
 assert.equal(createHash('sha256').update(readFileSync(new URL('../examples/debug/runtime-variables.zxbas',import.meta.url))).digest('hex'),fixture.sourceSha256);
 const result=decodeBasicVariables(original());assert.equal(result.kind,'decoded',JSON.stringify(result.issues));
 assert.deepEqual(result.variables.map(variable=>variable.name),['a','longname','f','s$','e$','n','c$','i']);
 const [a,long,f,s,e,n,c,i]=result.variables;
 assert.equal(a.value,123);assert.equal(a.offset,0);assert.equal(long.value,-456);assert.equal(long.offset,6);
 assert.equal(f.value,3435973837/34359738368);assert.deepEqual(s.bytes,[104,105,13,255]);assert.equal(displayRuntimeString(s.bytes),'"hi\\x0D\\xFF"');assert.deepEqual(e.bytes,[]);
 assert.deepEqual(n.dimensions,[2,2]);assert.deepEqual(n.values,[1,-2,.5,65536]);assert.equal(n.offset,35);assert.equal(n.dataOffset,43);
 assert.deepEqual(c.dimensions,[2,3]);assert.deepEqual(c.bytes,[97,98,32,88,89,90]);assert.equal(c.offset,63);
 assert.equal(i.kind,'for');assert.equal(i.value,1);assert.equal(i.limit,2);assert.equal(i.step,1);assert.equal(i.loopLine,50);assert.equal(i.loopStatement,2);assert.equal(i.offset,77);
 assert.ok(Object.isFrozen(result.variables));assert.ok(Object.isFrozen(n.values));
});
test('runtime string bytes are not parsed as source or incomplete print controls and returned storage owns Buffer inputs',()=>{
 const input=original(),result=decodeBasicVariables(input);input.fill(0);assert.equal(result.variables[0].value,123);assert.equal(result.bytes[0],0x61);
 const raw=decodeBasicVariables(Uint8Array.from([0x53,1,0,0x16,0x80]));assert.equal(raw.kind,'decoded');assert.deepEqual(raw.variables[0].bytes,[0x16]);assert.equal(displayRuntimeString(raw.variables[0].bytes),'"\\x16"');
 assert.equal(displayRuntimeString([0x5e,0x60,0x7f]),'"↑£©"');assert.throws(()=>displayRuntimeString([256]));
});
test('malformed runtime tables retain raw bytes and never resynchronize or claim a complete semantic view',()=>{
 for(const [input,code] of [[[], 'missing-terminator'],[[0x61,0,0],'truncated-record'],[[0x20,0x80],'unknown-tag'],[[0xa1,1,0x80],'invalid-name'],[[0x80,0],'trailing-bytes']]) {
  const result=decodeBasicVariables(Uint8Array.from(input));assert.equal(result.kind,'unsupported');assert.equal(result.issues[0].code,code);assert.deepEqual(result.bytes,input);
 }
 const dimensions=original();dimensions[39]=0;assert.equal(decodeBasicVariables(dimensions).issues[0].code,'invalid-array');
 const numeric=original();numeric[44]=7;assert.equal(decodeBasicVariables(numeric).issues[0].code,'invalid-number');
 const missing=original().slice(0,-1);assert.equal(decodeBasicVariables(missing).issues[0].code,'missing-terminator');
 const duplicate=Uint8Array.from([...original().slice(0,-1),...original().slice(0,6),0x80]);assert.equal(decodeBasicVariables(duplicate).issues[0].code,'duplicate-name');
 assert.equal(decodeBasicVariables(Uint8Array.of(0x80)).kind,'decoded');
});
test('shared stored-number projection validates shape without evaluating BASIC source',()=>{
 assert.equal(readSpectrumNumber([127,127,255,255,255]).value,0.5-2**-33);assert.equal(readSpectrumNumber([128,0,0,0,0]).value,0.5);
 assert.equal(readSpectrumNumber([0,255,254,255,0]).value,-2);assert.equal(readSpectrumNumber([145,0,0,0,0]).value,65536);
 for(const bytes of [[0,1,0,0,0],[0,0,0,0,1],[0],[256,0,0,0,0]])assert.equal(readSpectrumNumber(bytes).kind,'error');
});
