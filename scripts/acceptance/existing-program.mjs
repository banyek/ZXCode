import assert from 'node:assert/strict';
import {mkdirSync,readdirSync,writeFileSync,readFileSync,existsSync} from 'node:fs';
import {resolve,isAbsolute,join} from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const args=process.argv.slice(2);
assert.ok(args.length===2 && args[0]==='--output' && isAbsolute(args[1]),'Usage: npm run test:existing -- --output /absolute/empty/directory');
const output=resolve(args[1]);mkdirSync(output,{recursive:true});assert.equal(readdirSync(output).length,0,'Evidence directory must be empty');
assert.ok(process.env.npm_execpath,'Run through npm under Node 24');
const root=fileURLToPath(new URL('../../',import.meta.url));
const child=spawn(process.execPath,[process.env.npm_execpath,'run','test:vsix'],{cwd:root,env:{...process.env,ZXCODE_TEST_WORKFLOW_EVIDENCE:output},stdio:['ignore','pipe','pipe']});
let log='';for(const stream of [child.stdout,child.stderr]) stream.on('data',chunk=>{log+=chunk;process.stdout.write(chunk);});
const deadline=setTimeout(()=>child.kill('SIGTERM'),180000);
try {
 const status=await new Promise((resolveStatus,reject)=>{child.once('error',reject);child.once('close',(code,signal)=>resolveStatus({code,signal}));});
 writeFileSync(join(output,'native-host.log'),log);
 assert.equal(status.code,0,`Installed native workflow failed (${status.signal ?? status.code})`);
 const original=readFileSync(join(output,'existing-original.tap')), preserved=readFileSync(join(output,'existing-preserved.tap'));
 assert.deepEqual(preserved,original);
 const native=JSON.parse(readFileSync(join(output,'native-workflow.json'),'utf8'));
 assert.equal(native.renumber.kind,'preview');assert.equal(native.outlineLines,10);assert.equal(native.remainingDiagnostics,0);
 const refused=join(output,'changed-preserving.tap');
 const rejected=spawnSync(process.execPath,[join(root,'packages/cli/bin/zxcode.mjs'),'rebuild',join(output,'existing-transformed.zxbas'),'--reference',join(output,'existing-original.tap'),'--output',refused],{encoding:'utf8',timeout:30000});
 assert.equal(rejected.status,1);assert.match(rejected.stderr,/changed-program/);assert.equal(existsSync(refused),false);
 const hash=file=>createHash('sha256').update(readFileSync(join(output,file))).digest('hex');
 writeFileSync(join(output,'report.json'),JSON.stringify({schemaVersion:1,status:'passed',nativeCommandsVerified:true,changedReferenceRejected:true,preservedTapBytes:original.length,originalTapSha256:hash('existing-original.tap'),preservedTapSha256:hash('existing-preserved.tap'),transformedTapSha256:hash('existing-transformed.tap'),originalRomExecution:'run optional verify-existing-workflow-rom.py against this directory'},null,2)+'\n');
} finally {clearTimeout(deadline);}
