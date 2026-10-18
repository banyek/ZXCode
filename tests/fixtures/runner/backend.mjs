import {readFile} from "node:fs/promises";
import {dirname,join} from "node:path";
export function backend() {
  const launches=[];const events=[];
  return {id:'fixture',capabilities:{transport:'external-process',formats:['tap'],targets:['spectrum-48k'],features:['stop']},launches,events,
    async launch(request) {
      const bytes=await readFile(request.artifact.path);
      const metadataText=await readFile(join(dirname(request.artifact.path),"build.json"),"utf8");
      let state='running';let finish;
      const finished=new Promise(resolve=>{finish=resolve;});
      const index=launches.length;
      const close=()=>{state='exited';finish({state:'exited',code:0,signal:null});};
      const session={id:`session-${index}`,backendId:'fixture',artifact:request.artifact,get state(){return state;},finished,
        async stop(){events.push(`stop-${index}`);state='stopped';finish({state:'stopped',code:0,signal:null});return {kind:'success'};}};
      launches.push({request,bytes,metadataText,metadata:JSON.parse(metadataText),session,close});events.push(`launch-${index}`);
      return {kind:'success',session};
    }};
}
