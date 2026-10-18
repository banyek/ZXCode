import test from 'node:test';
import assert from 'node:assert/strict';
import {runtimeManifest,correlateDispatch} from '../scripts/research/runtime-correlation.mjs';
const ROM='d55daa439b673b0e3f5897f99ac37ecb45f974d1862b4dadb85dec34af99cb42';
test('research runtime mapping uses live program base and exact encoded statement starts',()=>{
 const manifest=runtimeManifest();
 for(const programBase of [23755,23819,24012])for(const line of manifest.sourceMap)for(const [index,statement] of line.statements.entries()) {
  const result=correlateDispatch(manifest,{romSha256:ROM,pc:0x1b3d,iy:0x5c3a,flags:128,sourceVersion:1,sourceSha256:manifest.sourceSha256,programBase,variablesAddress:programBase+manifest.programHex.length/2,characterAddress:programBase+statement.encodedRange.offset,programHex:manifest.programHex,line:line.basicLineNumber,statement:index+1});
  assert.equal(result.kind,'mapped');assert.deepEqual(result.sourceRange,statement.sourceRange);
 }
});
test('research runtime mapping refuses stale, non-dispatch, modified and mismatched observations',()=>{
 const manifest=runtimeManifest(),valid={romSha256:ROM,pc:0x1b3d,iy:0x5c3a,flags:128,sourceVersion:1,sourceSha256:manifest.sourceSha256,programBase:23755,variablesAddress:23755+manifest.programHex.length/2,characterAddress:23759,programHex:manifest.programHex,line:10,statement:1};
 for(const change of [{romSha256:'wrong'},{pc:0x12ac},{flags:0},{iy:0},{sourceVersion:2},{sourceSha256:'other'},{programHex:'ff'+manifest.programHex.slice(2)},{variablesAddress:65536},{characterAddress:23760},{line:20},{statement:2}]) assert.equal(correlateDispatch(manifest,{...valid,...change}).kind,'unmapped',JSON.stringify(change));
});
