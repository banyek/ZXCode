import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createWriteStream,mkdirSync,mkdtempSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {isAbsolute,join,resolve} from 'node:path';
import {finished} from 'node:stream/promises';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';
const {values}=parseArgs({options:{fuse:{type:'string'},'headless-fuse':{type:'string'},rom:{type:'string'},output:{type:'string'},'hold-ms':{type:'string'},help:{type:'boolean'}}});
if(values.help) {console.log('npm run test:run -- --fuse /absolute/fuse [--headless-fuse /absolute/fuse --rom /absolute/48.rom] [--output /empty/evidence] [--hold-ms 10000]');process.exit(0);}
assert.equal(Number(process.versions.node.split('.')[0]),24,'Use Node 24 for editor acceptance');
assert.ok(values.fuse && isAbsolute(values.fuse),'Provide --fuse with an absolute CLI executable path');
assert.ok(process.env.npm_execpath,'Invoke through npm run test:run');
const hold=Number(values['hold-ms']??'10000');
assert.ok(Number.isSafeInteger(hold)&&hold>=1000&&hold<=30000,'Hold must be 1000..30000 ms');
const root=fileURLToPath(new URL('../../',import.meta.url));
const output=values.output?resolve(values.output):mkdtempSync(join(tmpdir(),'zxcode-m6-acceptance-'));
mkdirSync(output,{recursive:true});
assert.equal(readdirSync(output).length,0,'Choose an empty acceptance output directory');
const reportPath=join(output,'report.json');
const baseline=JSON.parse(readFileSync(join(root,'docs/evidence/m6-fuse-sample.json'),'utf8'));
const hash=(bytes)=>createHash('sha256').update(bytes).digest('hex');
const report={schemaVersion:1,status:'running',host:process.platform,output,desktopVisualInspection:'not-asserted-by-automation'};
const save=()=>writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');
save();
try {
  if(values['headless-fuse']) {
    assert.ok(isAbsolute(values['headless-fuse'])&&values.rom&&isAbsolute(values.rom),'Capture requires absolute --headless-fuse and --rom paths');
    report.romSha256=hash(readFileSync(values.rom));
    assert.equal(report.romSha256,baseline.romSha256,'Use the reviewed original 48K ROM');
  }
  console.log(`M6 acceptance evidence: ${output}`);
  const log=createWriteStream(join(output,'native-host.log'));
  const child=spawn(process.execPath,[process.env.npm_execpath,'run','test:vsix'],{cwd:root,env:{...process.env,ZXCODE_TEST_FUSE:values.fuse,ZXCODE_TEST_EVIDENCE:output,ZXCODE_TEST_RUN_HOLD_MS:String(hold)},stdio:['ignore','pipe','pipe'],shell:false});
  child.stdout.on('data',(data)=>{log.write(data);process.stdout.write(data);});
  child.stderr.on('data',(data)=>{log.write(data);process.stderr.write(data);});
  try {await new Promise((resolveDone,reject)=>{child.once('error',reject);child.once('close',(code)=>code===0?resolveDone():reject(new Error(`Installed host exited ${code}`)));});}
  finally {log.end();await finished(log);}
  const native=JSON.parse(readFileSync(join(output,'native-session.json'),'utf8'));
  const metadata=JSON.parse(readFileSync(join(output,'native-build.json'),'utf8'));
  const bytes=readFileSync(join(output,'native-run.tap'));
  const {readBasicTap}=await import(new URL('../../packages/core/dist/index.js',import.meta.url));
  const tape=readBasicTap(bytes);assert.equal(tape.kind,'success');
  assert.equal(native.emulator,values.fuse);assert.equal(native.backendId,'fuse');
  assert.ok(native.sourceId.endsWith('/getting-started.zxbas'));
  assert.equal(metadata.buildId,native.buildId);assert.equal(metadata.sourceVersion,native.version);assert.equal(metadata.source.id,native.sourceId);
  assert.equal(metadata.sourceSha256,hash(metadata.source.text));
  assert.equal(metadata.sourceSha256,baseline.sourceSha256);
  assert.equal(metadata.tapSha256,hash(bytes));assert.equal(metadata.tapSha256,baseline.tapSha256,'Capture must be the authentic reviewed sample TAP produced by native Run');
  assert.equal(metadata.programSha256,hash(tape.programData));assert.equal(metadata.programByteLength,tape.programData.length);
  assert.equal(tape.autostartLine,10);assert.equal(metadata.autostartLine,10);
  assert.equal(metadata.sourceUnits,'utf16-code-units');assert.equal(metadata.encodedUnits,'basic-program-bytes');
  let offset=0;
  for(const line of metadata.sourceMap) {
    assert.equal(line.encodedOffset,offset);offset+=line.encodedLength;
    assert.ok(offset<=metadata.programByteLength);
    for(const range of [line.sourceRange,...line.statements.map((statement)=>statement.sourceRange)]) assert.ok(range.sourceId===metadata.source.id&&range.start>=0&&range.end>=range.start&&range.end<=metadata.source.text.length);
    for(const statement of line.statements) if(statement.encodedRange) assert.ok(statement.encodedRange.offset>=line.encodedOffset+4&&statement.encodedRange.offset+statement.encodedRange.length<=offset);
  }
  assert.equal(offset,metadata.programByteLength);
  report.native={installedHost:true,backend:'fuse',sourceSha256:metadata.sourceSha256,tapSha256:metadata.tapSha256,programSha256:metadata.programSha256,buildId:metadata.buildId,autostart:10,sourceMapLines:metadata.sourceMap.length,workflow:'open/edit/diagnose/complete/navigate/build/run/replace/stop/identity/shutdown'};
  if(values['headless-fuse']) {
    const capture=join(output,'rom-capture');
    const result=spawnSync('python3',[join(root,'scripts/research/verify-fuse-launch.py'),'--fuse',values['headless-fuse'],'--tap',join(output,'native-run.tap'),'--output',capture,'--rom',values.rom,'--capture'],{cwd:root,encoding:'utf8',timeout:40000,shell:false});
    assert.equal(result.status,0,result.stdout+result.stderr);
    const captured=JSON.parse(readFileSync(join(capture,'result.json'),'utf8'));
    assert.equal(captured.artifacts.screen.pixel_crc32,baseline.screenPixelCrc32,'Same editor-produced TAP must produce the reviewed original-ROM screen');
    report.capture={backend:'Fuse null UI development automation',frames:500,pixelCrc32:captured.artifacts.screen.pixel_crc32,screenSha256:hash(readFileSync(join(capture,'screen.png'))),expectedRows:baseline.observedRows};
  }
  report.status='passed';save();console.log(`M6 installed editor/run acceptance passed: ${reportPath}`);
} catch(error) {report.status='failed';report.error=error instanceof Error?error.message:String(error);save();throw error;}
