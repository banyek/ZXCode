import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {SourceDocument,checkProgram,writeBasicTap} from '../../packages/core/dist/index.js';
const ROM='d55daa439b673b0e3f5897f99ac37ecb45f974d1862b4dadb85dec34af99cb42';
const hash=input=>createHash('sha256').update(input).digest('hex');
export function runtimeManifest() {
 const text=readFileSync(new URL('../../examples/debug/runtime-dispatch.zxbas',import.meta.url),'utf8');
 const source=new SourceDocument('runtime-dispatch.zxbas',text),checked=checkProgram(source);assert.equal(checked.kind,'success');
 return {schemaVersion:1,sourceId:source.id,sourceText:text,sourceVersion:1,sourceSha256:hash(text),programHex:Buffer.from(checked.encodedProgram.programBytes).toString('hex'),sourceMap:checked.encodedProgram.lines};
}
/** Research mapper: no nearest-range fallback, no mutable-FN or self-modifying scope. */
export function correlateDispatch(manifest,observation) {
 const unmapped=reason=>({kind:'unmapped',reason});
 if(observation.romSha256!==ROM)return unmapped('wrong-rom');
 if(observation.pc!==0x1b3d || observation.iy!==0x5c3a || !(observation.flags&128))return unmapped('not-runtime-dispatch');
 if(observation.sourceVersion!==manifest.sourceVersion || observation.sourceSha256!==manifest.sourceSha256 || hash(manifest.sourceText)!==manifest.sourceSha256)return unmapped('stale-source');
 const length=manifest.programHex.length/2;
 if(![observation.programBase,observation.variablesAddress,observation.characterAddress].every(value=>Number.isSafeInteger(value)&&value>=0&&value<=65535)||observation.variablesAddress-observation.programBase!==length||observation.characterAddress<observation.programBase||observation.characterAddress>=observation.variablesAddress)return unmapped('invalid-program-bounds');
 if(observation.programHex.toLowerCase()!==manifest.programHex)return unmapped('changed-program');
 const offset=observation.characterAddress-observation.programBase;
 const matches=manifest.sourceMap.flatMap(line=>line.statements.flatMap((statement,index)=>statement.encodedRange?.offset===offset && statement.encodedRange.length>0 ? [{line,statement,index}] : []));
 if(matches.length!==1)return unmapped('ambiguous-or-unmapped-offset');
 const {line,statement,index}=matches[0];
 if(line.basicLineNumber!==observation.line || index+1!==observation.statement)return unmapped('interpreter-state-mismatch');
 const source=new SourceDocument(manifest.sourceId,manifest.sourceText),range=statement.sourceRange;
 if(range.sourceId!==source.id)return unmapped('foreign-source-range');
 const checked=source.range(range.start,range.end);
 return {kind:'mapped',line:line.basicLineNumber,statement:index+1,sourceRange:checked,position:source.positionAt(checked.start),sourceText:source.textInRange(checked)};
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
 const [command,path]=process.argv.slice(2);
 if(command==='prepare') {
  const manifest=runtimeManifest();mkdirSync(path,{recursive:true});writeFileSync(join(path,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  writeFileSync(join(path,'runtime.tap'),writeBasicTap(Buffer.from(manifest.programHex,'hex'),{filenameBytes:Buffer.from('TRACE     '),autostart:0x8000,variablesOffset:manifest.programHex.length/2}).tapBytes);
 } else if(command==='verify') {
  const manifest=JSON.parse(readFileSync(join(path,'manifest.json'),'utf8')),observed=JSON.parse(readFileSync(join(path,'observations.json'),'utf8'));
  const runs=observed.runs.map(run=>{
   const mapped=run.observations.map(observation=>correlateDispatch(manifest,observation));assert.ok(mapped.every(item=>item.kind==='mapped'),JSON.stringify(mapped));
   return {backend:run.backend,programBase:run.programBase,locations:mapped};
  });
  assert.ok(runs.length>=3);for(const run of runs)assert.deepEqual(run.locations,runs[0].locations);
  const result={schemaVersion:1,status:'passed',sourceSha256:manifest.sourceSha256,programSha256:hash(Buffer.from(manifest.programHex,'hex')),runs};writeFileSync(join(path,'correlation-report.json'),JSON.stringify(result,null,2)+'\n');console.log(`Verified ${runs.length} runtime traces with identical checked source ranges`);
 } else throw new Error('Usage: runtime-correlation.mjs prepare|verify directory');
}
