import {runTests} from '@vscode/test-electron';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
const isolated=mkdtempSync(join(tmpdir(),'zxcode-vscode-'));
const userData=join(isolated,'user-data');
const testFiles=join(isolated,'files');
mkdirSync(testFiles);
mkdirSync(join(userData,'User'),{recursive:true});
writeFileSync(join(userData,'User','settings.json'),JSON.stringify({'chat.disableAIFeatures':true,'workbench.secondarySideBar.defaultVisibility':'hidden','editor.wordBasedSuggestions':'off','telemetry.telemetryLevel':'off','update.mode':'none','extensions.autoCheckUpdates':false,'extensions.autoUpdate':false,'workbench.startupEditor':'none'}));
try {
  await runTests({
    version:'1.140.0',reuseMachineInstall:false,
    ...(process.env.ZXCODE_VSCODE_EXECUTABLE?{vscodeExecutablePath:process.env.ZXCODE_VSCODE_EXECUTABLE}:{}),
    extensionDevelopmentPath:fileURLToPath(new URL('../packages/extension/',import.meta.url)),
    extensionTestsEnv:{ZXCODE_TEST_FILES:testFiles},
    extensionTestsPath:fileURLToPath(new URL('../packages/extension/dist/test-runner.cjs',import.meta.url)),
    launchArgs:[testFiles,`--user-data-dir=${userData}`,`--extensions-dir=${join(isolated,'extensions')}`,'--skip-welcome','--skip-release-notes','--disable-workspace-trust','--disable-gpu','--new-window']
  });
} finally {rmSync(isolated,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
