import {writeFileSync} from 'node:fs';
const [moduleUrl,tap,report]=process.argv.slice(2);
const {createFuseBackend}=await import(moduleUrl);
const result=await createFuseBackend().launch({artifact:{path:tap,format:'tap',target:'spectrum-48k',buildId:'discovery-build'}});
if(result.kind==='success') {await result.session.stop();await result.session.finished;}
writeFileSync(report,JSON.stringify({kind:result.kind,...(result.kind==='error'?{message:result.message}:{backendId:result.session.backendId})}));
