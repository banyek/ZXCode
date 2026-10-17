import {build} from 'esbuild';
import {rmSync} from 'node:fs';
if(process.argv.includes('--clean')) rmSync(new URL('../packages/extension/dist/',import.meta.url),{recursive:true,force:true});
else await build({
  entryPoints:{extension:'packages/extension/src/extension.ts','test-runner':'packages/extension/test/runner.ts',documents:'packages/extension/src/documents.ts'},
  outdir:'packages/extension/dist',outExtension:{'.js':'.cjs'},bundle:true,platform:'node',format:'cjs',target:'es2023',external:['vscode'],sourcemap:true,logLevel:'warning'
});
