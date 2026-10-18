import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {access,chmod,mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {delimiter,dirname,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {promisify} from 'node:util';
import test from 'node:test';
import {buildTap,SourceDocument} from '../packages/core/dist/index.js';
import {createFuseBackend,fuseArguments,prepareFuseConfiguration} from '../packages/runner/dist/index.js';
const execute=promisify(execFile);
const fake=`#!/usr/bin/env node
const fs=require('node:fs');
const path=require('node:path');
const config=path.join(process.env.XDG_CONFIG_HOME,'fuse-emulator','fuserc');
const info={configuration:process.env.XDG_CONFIG_HOME,text:fs.readFileSync(config,'utf8'),arguments:process.argv.slice(2)};
if(process.argv.includes('--version')) {fs.writeFileSync(path.join(__dirname,'probe.json'),JSON.stringify(info));console.log('The Free Unix Spectrum Emulator (Fuse) version 1.10.0.');}
else {fs.writeFileSync(path.join(__dirname,'launch.json'),JSON.stringify(info));process.on('SIGTERM',()=>process.exit(0));setInterval(()=>{},1000);}
`;
async function fixture() {
  const directory=await mkdtemp(join(tmpdir(),'zxcode-fuse-test-'));
  const tap=join(directory,"name with ' and $(echo X).tap");
  const built=buildTap(new SourceDocument('test.zxbas','10 STOP'),{filenameBytes:new Uint8Array(10).fill(32),autostart:0x8000});
  assert.equal(built.kind,'success');
  await writeFile(tap,built.tap.tapBytes);
  return {directory,tap,request:{artifact:{path:tap,format:'tap',target:'spectrum-48k',buildId:'build-test'}}};
}
async function waitFile(file) {
  const end=Date.now()+3000;
  while(Date.now()<end) {try {return JSON.parse(await readFile(file,'utf8'));} catch {await new Promise((resolve)=>setTimeout(resolve,10));}}
  throw new Error(`Fixture did not write ${file}`);
}
test('Fuse arguments preserve artifact path as one shell-free argument',()=>{
  const path="/build/a ' $(echo X).tap";
  assert.deepEqual(fuseArguments({artifact:{path,format:'tap',target:'spectrum-48k',buildId:'x'}}),['--machine','48','--auto-load','--no-autosave-settings','--no-confirm-actions','--no-sound','--tape',path]);
});
test('platform configuration is private and format-specific without changing the parent environment',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'zxcode-config-test-'));
  const original={XDG_CONFIG_HOME:process.env.XDG_CONFIG_HOME,USERPROFILE:process.env.USERPROFILE};
  try {
    const unix=await prepareFuseConfiguration(join(directory,'unix'),'darwin','xml');
    assert.equal(await readFile(join(unix.XDG_CONFIG_HOME,'fuse-emulator','fuserc'),'utf8'),'<settings/>\n');
    const windows=await prepareFuseConfiguration(join(directory,'windows'),'win32','ini');
    assert.equal(await readFile(join(windows.USERPROFILE,'fuse.cfg'),'utf8'),'');
    assert.equal(windows.APPDATA,process.env.APPDATA);
    assert.deepEqual({XDG_CONFIG_HOME:process.env.XDG_CONFIG_HOME,USERPROFILE:process.env.USERPROFILE},original);
  } finally {await rm(directory,{recursive:true,force:true});}
});
test('Fuse rejects malformed artifacts and actionable executable configuration errors',async()=>{
  const f=await fixture();
  try {
    const absent=await createFuseBackend({executable:join(f.directory,'missing')}).launch(f.request);
    assert.equal(absent.code,'not-found');
    assert.equal((await createFuseBackend({executable:'relative-fuse'}).launch(f.request)).code,'invalid-request');
    assert.equal((await createFuseBackend({executable:process.execPath}).launch(f.request)).code,'not-executable');
    assert.equal((await createFuseBackend({executable:f.directory}).launch(f.request)).code,'not-executable');
    await writeFile(f.tap,new Uint8Array([0,0]));
    assert.equal((await createFuseBackend({executable:process.execPath}).launch(f.request)).code,'invalid-request');
  } finally {await rm(f.directory,{recursive:true,force:true});}
});
test('Fuse adapter verifies a candidate, owns configuration through exit and preserves TAP bytes',{skip:process.platform==='win32'},async()=>{
  const f=await fixture();let session;
  try {
    const executable=join(f.directory,'fake fuse');
    await writeFile(executable,fake);await chmod(executable,0o755);
    const before=await readFile(f.tap);
    const result=await createFuseBackend({executable}).launch(f.request);
    assert.equal(result.kind,'success');session=result.session;
    const launched=await waitFile(join(f.directory,'launch.json'));
    assert.equal(launched.text,'<settings/>\n');
    assert.deepEqual(launched.arguments,fuseArguments(f.request));
    assert.ok(Object.isFrozen(session.artifact));
    await session.stop();
    assert.equal((await session.finished).state,'stopped');
    await assert.rejects(access(launched.configuration),{code:'ENOENT'});
    assert.deepEqual(await readFile(f.tap),before);
  } finally {await session?.stop();await rm(f.directory,{recursive:true,force:true});}
});
test('Fuse PATH discovery skips another program and finds an identifying executable',{skip:process.platform==='win32'},async()=>{
  const f=await fixture();
  try {
    await writeFile(join(f.directory,'fuse'),'#!/usr/bin/env node\nconsole.log("unrelated program");\n');
    await chmod(join(f.directory,'fuse'),0o755);
    await writeFile(join(f.directory,'fuse-sdl2'),fake);await chmod(join(f.directory,'fuse-sdl2'),0o755);
    const report=join(f.directory,'discovery.json');
    await execute(process.execPath,[fileURLToPath(new URL('./fixtures/runner/discover.mjs',import.meta.url)),pathToFileURL(fileURLToPath(new URL('../packages/runner/dist/index.js',import.meta.url))).href,f.tap,report],{env:{...process.env,PATH:[f.directory,dirname(process.execPath)].join(delimiter)},timeout:10000});
    assert.deepEqual(JSON.parse(await readFile(report,'utf8')),{kind:'success',backendId:'fuse'});
  } finally {await rm(f.directory,{recursive:true,force:true});}
});
test('Fuse version probing has a forced deadline and cleans private configuration',{skip:process.platform==='win32',timeout:10000},async()=>{
  const f=await fixture();
  try {
    const executable=join(f.directory,'hanging-fuse');
    await writeFile(executable,fake.replace("console.log('The Free Unix Spectrum Emulator (Fuse) version 1.10.0.');",'setInterval(()=>{},1000);'));
    await chmod(executable,0o755);
    const result=await createFuseBackend({executable}).launch(f.request);
    assert.equal(result.code,'launch-failed');
    assert.match(result.message,/2-second deadline/);
    const probe=await waitFile(join(f.directory,'probe.json'));
    await assert.rejects(access(probe.configuration),{code:'ENOENT'});
  } finally {await rm(f.directory,{recursive:true,force:true});}
});
test('startup can be cancelled during executable probing',{skip:process.platform==='win32',timeout:10000},async()=>{
  const f=await fixture();
  try {
    const executable=join(f.directory,'cancelled-fuse');
    await writeFile(executable,fake.replace("console.log('The Free Unix Spectrum Emulator (Fuse) version 1.10.0.');",'setInterval(()=>{},1000);'));
    await chmod(executable,0o755);
    const controller=new AbortController();
    const pending=createFuseBackend({executable}).launch(f.request,{signal:controller.signal});
    const probe=await waitFile(join(f.directory,'probe.json'));
    controller.abort();
    assert.equal((await pending).code,'cancelled');
    await assert.rejects(access(probe.configuration),{code:'ENOENT'});
  } finally {await rm(f.directory,{recursive:true,force:true});}
});
test('legacy Fuse versions are rejected before they can ignore private XDG configuration',{skip:process.platform==='win32'},async()=>{
  const f=await fixture();
  try {
    const executable=join(f.directory,'old-fuse');
    await writeFile(executable,fake.replace('version 1.10.0.','version 1.6.0.'));
    await chmod(executable,0o755);
    const result=await createFuseBackend({executable}).launch(f.request);
    assert.equal(result.code,'unsupported-version');assert.match(result.message,/1.8 or later/);
    await assert.rejects(access(join(f.directory,'launch.json')),{code:'ENOENT'});
  } finally {await rm(f.directory,{recursive:true,force:true});}
});
