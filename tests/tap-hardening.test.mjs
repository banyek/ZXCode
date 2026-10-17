import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { MAX_TAP_PAYLOAD_LENGTH, readBasicTap, readTapBlocks, writeBasicTap, writeTapBlock } from '@zxcode/core';
const fixture=JSON.parse(readFileSync(new URL('./fixtures/tap-metadata.json',import.meta.url),'utf8'));
const autostart=JSON.parse(readFileSync(new URL('./fixtures/autostart-rom.json',import.meta.url),'utf8'));
const bytes=(hex)=>Uint8Array.from(Buffer.from(hex,'hex'));
const baseline=()=>bytes(fixture.cases[0].tapHex);
function headerEdit(index,value){const tap=baseline();tap[index]=value;tap[20]=tap.slice(2,20).reduce((a,b)=>a^b,0);return tap;}
test('independently packed TAP headers and opaque blocks match exact bytes',()=>{
  for(const entry of fixture.cases){
    const metadata={filenameBytes:bytes(entry.filenameHex),autostart:entry.autostart,variablesOffset:entry.variablesOffset};
    const written=writeBasicTap(bytes(entry.payloadHex),metadata).tapBytes;
    assert.equal(Buffer.from(written).toString('hex'),entry.tapHex,entry.name);
    const parsed=readBasicTap(written);
    assert.equal(parsed.kind,'success',entry.name);
    assert.deepEqual(parsed.metadata,metadata);
    assert.deepEqual(parsed.programData,bytes(entry.payloadHex));
    assert.deepEqual(writeBasicTap(parsed.programData,parsed.metadata).tapBytes,written);
  }
  for(const entry of fixture.blocks){
    const written=writeTapBlock(entry.flag,bytes(entry.payloadHex));
    assert.equal(Buffer.from(written).toString('hex'),entry.blockHex);
    const result=readTapBlocks(written);
    assert.equal(result.kind,'success');
    assert.equal(result.blocks[0].flag,entry.flag);
    assert.deepEqual(result.blocks[0].payload,bytes(entry.payloadHex));
  }
});
test('autostart interpretation matches both original-ROM high-bit boundaries',()=>{
  for(const reference of autostart.cases){
    const entry=fixture.cases.find((entry)=>entry.autostart===reference.word);
    const result=readBasicTap(bytes(entry.tapHex));
    assert.equal(result.kind,'success');
    assert.equal(result.metadata.autostart,reference.word);
    assert.equal(result.autostartEnabled,reference.enabled,reference.word);
    assert.equal(result.autostartLine,reference.enabled?reference.word:undefined);
  }
});
test('maximum payload preserves 16-bit lengths, header fields and independent image hash',()=>{
  assert.equal(MAX_TAP_PAYLOAD_LENGTH,65533);
  const entry=fixture.maximum;
  const payload=Uint8Array.from({length:entry.payloadLength},(_,index)=>index&255);
  const metadata={filenameBytes:bytes(entry.filenameHex),autostart:entry.autostart,variablesOffset:entry.variablesOffset};
  const tap=writeBasicTap(payload,metadata).tapBytes;
  assert.equal(tap.length,entry.tapLength);
  assert.equal(Buffer.from(tap.slice(0,21)).toString('hex'),entry.headerHex);
  assert.equal(createHash('sha256').update(tap).digest('hex'),entry.tapSha256);
  const parsed=readBasicTap(tap);
  assert.equal(parsed.kind,'success');
  assert.deepEqual(parsed.programData,payload);
  assert.throws(()=>writeBasicTap(new Uint8Array(65534),metadata),RangeError);
});
test('truncation, missing flag/parity and checksum failures reject without repair',()=>{
  for(const [tap,code,offset] of [[Uint8Array.of(19),'truncated-length',0],[Uint8Array.of(0,0),'invalid-block-length',0],[Uint8Array.of(1,0,0),'invalid-block-length',0],[Uint8Array.of(2,0,0),'truncated-block',2],[Uint8Array.of(255,255,0),'truncated-block',2]]){
    const result=readTapBlocks(tap);
    assert.equal(result.kind,'error');
    assert.equal(result.issues[0].code,code);
    assert.equal(result.issues[0].offset,offset);
    assert.ok(Object.isFrozen(result.issues[0]));
  }
  const tap=baseline();tap[20]^=1;
  const bad=readBasicTap(tap);
  assert.equal(bad.kind,'error');
  assert.equal(bad.issues[0].code,'checksum-mismatch');
  assert.equal(bad.issues[0].offset,2);
  const extra=Uint8Array.from([...baseline(),0]);
  const truncated=readTapBlocks(extra);
  assert.equal(truncated.kind,'error');
  assert.equal(truncated.issues[0].offset,extra.length-1);
  assert.throws(()=>readTapBlocks([1,2]),TypeError);
});
test('BASIC header validation distinguishes malformed fields from unsupported layouts',()=>{
  for(const [tap,code] of [[headerEdit(3,1),'unsupported-header-type'],[headerEdit(14,0),'data-length-mismatch'],[headerEdit(18,8),'invalid-variables-offset']]){
    assert.equal(readTapBlocks(tap).kind,'success');
    const result=readBasicTap(tap);
    assert.equal(result.kind,'error');
    assert.equal(result.issues[0].code,code);
  }
  const dataBlock=baseline().slice(21);
  const wrongHeader=Uint8Array.from([...bytes(fixture.blocks[0].blockHex),...dataBlock]);
  assert.equal(readBasicTap(wrongHeader).issues[0].code,'invalid-basic-header');
  const several=Uint8Array.from([...baseline(),...bytes(fixture.blocks[1].blockHex)]);
  assert.equal(readTapBlocks(several).kind,'success');
  assert.equal(readBasicTap(several).issues[0].code,'unsupported-layout');
  assert.deepEqual(readTapBlocks(new Uint8Array()),{kind:'success',blocks:[]});
  assert.equal(readBasicTap(new Uint8Array()).issues[0].code,'unsupported-layout');
});
test('reader results own data across Uint8Array/Buffer inputs and metadata views',()=>{
  for(const input of [baseline(),Buffer.from(baseline())]){
    const original=Uint8Array.from(input);
    const result=readBasicTap(input);
    assert.equal(result.kind,'success');
    const name=result.metadata.filenameBytes.slice();
    const payload=result.programData.slice();
    input.fill(0);
    assert.deepEqual(result.metadata.filenameBytes,name);
    assert.deepEqual(result.programData,payload);
    assert.deepEqual(writeBasicTap(result.programData,result.metadata).tapBytes,original);
    result.blocks[0].payload.fill(0);
    result.blocks[1].payload.fill(0);
    assert.deepEqual(result.metadata.filenameBytes,name);
    assert.deepEqual(result.programData,payload);
    assert.ok(Object.isFrozen(result.metadata));
    assert.ok(Object.isFrozen(result.blocks));
  }
});
