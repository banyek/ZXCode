import {runTests,downloadAndUnzipVSCode,resolveCliArgsFromVSCodeExecutablePath} from '@vscode/test-electron';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const isolated=mkdtempSync(join(tmpdir(),'zxcode-vscode-'));
const userData=join(isolated,'user-data');
const testFiles=join(isolated,'files');
mkdirSync(testFiles);
mkdirSync(join(userData,'User'),{recursive:true});
writeFileSync(join(userData,'User','settings.json'),JSON.stringify({'chat.disableAIFeatures':true,'workbench.secondarySideBar.defaultVisibility':'hidden','editor.wordBasedSuggestions':'off','telemetry.telemetryLevel':'off','update.mode':'none','extensions.autoCheckUpdates':false,'extensions.autoUpdate':false,'workbench.startupEditor':'none'}));
try {
  const installed=process.argv.includes('--installed');
  const extensions=join(isolated,'extensions');
  let development=fileURLToPath(new URL('../packages/extension/',import.meta.url));
  let executable=process.env.ZXCODE_VSCODE_EXECUTABLE;
  if(installed) {
    executable??=await downloadAndUnzipVSCode({version:'1.140.0'});
    const [cli,...args]=resolveCliArgsFromVSCodeExecutablePath(executable,{reuseMachineInstall:false});
    const manifest=JSON.parse(readFileSync(new URL('../packages/extension/package.json',import.meta.url),'utf8'));
    const vsix=fileURLToPath(new URL(`../artifacts/${manifest.name}-${manifest.version}.vsix`,import.meta.url));
    const installation=spawnSync(cli,[...args,'--user-data-dir',userData,'--extensions-dir',extensions,'--install-extension',vsix,'--force'],{encoding:'utf8',env:{...process.env,ELECTRON_RUN_AS_NODE:'1'},shell:process.platform==='win32'});
    if(installation.status!==0) throw new Error(`VSIX install failed: ${installation.stdout} ${installation.stderr}`);
    console.log(installation.stdout);
    development=join(isolated,'harness');
    mkdirSync(development);
    writeFileSync(join(development,'package.json'),JSON.stringify({name:'zxcode-test-harness',publisher:'banyek',version:'0.0.0',engines:{vscode:'^1.140.0'}}));
  }
  await runTests({
    version:'1.140.0',reuseMachineInstall:false,
    ...(executable?{vscodeExecutablePath:executable}:{}),
    extensionDevelopmentPath:development,
    extensionTestsEnv:{ZXCODE_TEST_FILES:testFiles,ZXCODE_INSTALLED_ROOT:installed?extensions:"",...Object.fromEntries(["ZXCODE_TEST_FUSE","ZXCODE_TEST_EVIDENCE","ZXCODE_TEST_RUN_HOLD_MS"].flatMap((key)=>process.env[key]===undefined?[]:[[key,process.env[key]]]))},
    extensionTestsPath:fileURLToPath(new URL('../packages/extension/dist/test-runner.cjs',import.meta.url)),
    launchArgs:[testFiles,`--user-data-dir=${userData}`,`--extensions-dir=${extensions}`,'--skip-welcome','--skip-release-notes','--disable-workspace-trust','--disable-gpu','--new-window']
  });
} finally {rmSync(isolated,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
