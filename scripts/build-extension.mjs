import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
import {rmSync} from 'node:fs';
if(process.argv.includes('--clean')) rmSync(new URL('../packages/extension/dist/',import.meta.url),{recursive:true,force:true});
else {
  const result=await build({
    entryPoints:{extension:'packages/extension/src/extension.ts','test-runner':'packages/extension/test/runner.ts',documents:'packages/extension/src/documents.ts'},
    alias:{'@zxcode/core':fileURLToPath(new URL('../packages/core/src/index.ts',import.meta.url)),'@zxcode/runner':fileURLToPath(new URL('../packages/runner/src/index.ts',import.meta.url))},
    outdir:'packages/extension/dist',outExtension:{'.js':'.cjs'},bundle:true,platform:'node',format:'cjs',target:'es2023',external:['vscode'],sourcemap:true,metafile:true,logLevel:'warning'
  });
  if(Object.keys(result.metafile.inputs).some((path)=>/packages\/(core|runner)\/dist\//.test(path.replaceAll('\\','/')))) throw new Error('Extension must bundle one shared source core/runner, without duplicate compiled workspace copies.');
}
