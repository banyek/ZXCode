import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createVSIX} from '@vscode/vsce';
import {unzipSync,zipSync} from 'fflate';
const root=fileURLToPath(new URL('../',import.meta.url));
const staging=mkdtempSync(join(tmpdir(),'zxcode-package-'));
const stage=join(staging,'extension');
mkdirSync(stage);
const hash=(bytes)=>createHash('sha256').update(bytes).digest('hex');
try {
  const manifest=JSON.parse(readFileSync(join(root,'packages/extension/package.json'),'utf8'));
  delete manifest.dependencies;
  delete manifest.files;
  writeFileSync(join(stage,'package.json'),JSON.stringify(manifest,null,2)+'\n');
  const files={
    'dist/extension.cjs':'packages/extension/dist/extension.cjs',
    'syntaxes/zx-spectrum-basic.tmLanguage.json':'packages/extension/syntaxes/zx-spectrum-basic.tmLanguage.json',
    'language-configuration.json':'packages/extension/language-configuration.json',
    'README.md':'packages/extension/README.md',
    'getting-started.md':'docs/guides/getting-started.md',
    'examples/getting-started.zxbas':'examples/getting-started.zxbas'
  };
  for(const [destination,source] of Object.entries(files)) {
    mkdirSync(dirname(join(stage,destination)),{recursive:true});
    writeFileSync(join(stage,destination),readFileSync(join(root,source),"utf8").replace(/\r\n/g,"\n"));
  }
  // Runtime sourcemaps intentionally stay in the development checkout.
  const runtime=join(stage,'dist/extension.cjs');
  writeFileSync(runtime,readFileSync(runtime,'utf8').replace(/^\/\/# sourceMappingURL=.*$/m,''));
  const raw=join(staging,'raw.vsix');
  await createVSIX({cwd:stage,packagePath:raw,dependencies:false,skipLicense:true,rewriteRelativeLinks:false});
  const entries=unzipSync(readFileSync(raw));
  const expected=['[Content_Types].xml','extension.vsixmanifest','extension/package.json',...Object.keys(files).map((name)=>`extension/${name === "README.md" ? "readme.md" : name}`)].sort();
  assert.deepEqual(Object.keys(entries).sort(),expected,'Only allowlisted files enter the VSIX');
  const normalized={};
  for(const name of expected) normalized[name]=[entries[name],{mtime:new Date(1980,0,1),os:3,attrs:0,level:9}];
  const bytes=zipSync(normalized);
  const output=resolve(process.argv[2]??join(root,'artifacts',`${manifest.name}-${manifest.version}.vsix`));
  mkdirSync(dirname(output),{recursive:true});
  writeFileSync(output,bytes);
  const report={schemaVersion:1,name:manifest.name,version:manifest.version,sha256:hash(bytes),size:bytes.length,files:expected.map((path)=>({path,size:entries[path].length,sha256:hash(entries[path])}))};
  writeFileSync(output+'.json',JSON.stringify(report,null,2)+'\n');
  console.log(`Packaged ${output}\nSHA-256 ${report.sha256}`);
} finally {rmSync(staging,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
