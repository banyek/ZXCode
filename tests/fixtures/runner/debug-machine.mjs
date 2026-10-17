/** Scripted contract fixture, not a CPU emulator. Each step advances one address. */
let nextSession=0;
const success=value=>Object.freeze({kind:'success',value});
const failure=(code,message)=>Object.freeze({kind:'error',code,message});
const address=value=>Number.isSafeInteger(value) && value>=0 && value<=65535;
export function fakeDebugBackend({features=['pause','resume','step','register-read','memory-read','memory-write','breakpoints','reset']}={}) {
 return Object.freeze({id:'scripted-machine',async open(options) {
  if(options.signal?.aborted) return failure('cancelled','Startup cancelled');
  if(options.requiredFeatures?.some(feature=>!features.includes(feature))) return failure('unsupported-operation','Required feature unavailable');
  const id=`scripted-${++nextSession}`, memory=new Uint8Array(65536), listeners=new Set(), breakpoints=new Map();
  let phase='running',epoch=0,sequence=0,current,pc=32768,nextBreakpoint=0,finish;
  const finished=new Promise(resolve=>{finish=resolve;});
  const capabilities=Object.freeze({architecture:'z80',features:Object.freeze([...features]),readableRegisters:Object.freeze(features.includes('register-read')?['PC']:[]),writableRegisters:Object.freeze([]),maxReadBytes:features.includes('memory-read')?65536:0,maxBreakpoints:features.includes('breakpoints')?2:0,conditionKinds:Object.freeze([])});
  const emit=event=>{for(const listener of listeners) {try {listener(Object.freeze(event));} catch {/* Listener failure does not corrupt the owner. */}}};
  const stopped=(reason,ids=[])=>{phase='paused';current=Object.freeze({sessionId:id,epoch,sequence:++sequence,reason,pc,breakpointIds:Object.freeze(ids)});emit({kind:'stopped',stop:current});return success(current);};
  const guard=(feature,stop,operation)=>{
   if(phase==='closed') return failure('invalid-state','Machine closed');
   if(operation?.signal?.aborted) return failure('cancelled','Operation cancelled');
   if(!features.includes(feature)) return failure('unsupported-operation','Feature unavailable');
   if(stop!==undefined && (stop!==current || phase!=='paused')) return failure('stale-stop','Stop lease expired');
  };
  const invalidated=reason=>{epoch++;current=undefined;emit({kind:'invalidated',sessionId:id,epoch,reason});return stopped(reason);};
  const unsupported=async()=>failure('unsupported-operation','Feature unavailable');
  return success(Object.freeze({id,backendId:'scripted-machine',ownership:options.mode==='launch'?'owned':'attached',capabilities,finished,get phase(){return phase;},
   subscribe(listener){listeners.add(listener);return ()=>listeners.delete(listener);},
   async pause(operation){const error=guard('pause',undefined,operation);if(error)return error;return phase==='paused'?success(current):stopped('pause');},
   async resume(stop,operation){const error=guard('resume',stop,operation);if(error)return error;current=undefined;phase='running';emit({kind:'running',sessionId:id,epoch});return success();},
   async step(stop,operation){const error=guard('step',stop,operation);if(error)return error;pc=(pc+1)&65535;const hits=[...breakpoints.values()].filter(item=>item.request.address===pc).map(item=>item.id);return stopped(hits.length?'breakpoint':'step',hits);},
   async inspect(stop,request,operation){
    const error=guard('pause',stop,operation);if(error)return error;
    if(request.registers?.length && !features.includes('register-read'))return failure('unsupported-operation','Registers unavailable');
    if(request.memory?.length && !features.includes('memory-read'))return failure('unsupported-operation','Memory unavailable');
    const regions=request.memory??[];
    if(regions.some(region=>!address(region.address)||!Number.isSafeInteger(region.length)||region.length<1||region.address+region.length>65536)||regions.reduce((sum,region)=>sum+region.length,0)>capabilities.maxReadBytes)return failure('invalid-request','Memory range outside negotiated bounds');
    if(request.registers?.some(register=>register!=='PC'))return failure('unsupported-operation','Scripted fixture exposes PC only');
    return success(Object.freeze({stop,registers:Object.freeze(request.registers?.length?{PC:pc}:{}),memory:Object.freeze(regions.map(region=>Object.freeze({address:region.address,bytes:Object.freeze(Array.from(memory.slice(region.address,region.address+region.length)))})))}));
   },
   async writeMemory(stop,region,operation){const error=guard('memory-write',stop,operation);if(error)return error;if(!address(region.address)||region.address+region.bytes.length>65536||region.bytes.some(byte=>!Number.isSafeInteger(byte)||byte<0||byte>255))return failure('invalid-request','Invalid memory write');memory.set(region.bytes,region.address);return invalidated('write');},
   writeRegisters:unsupported,
   async addBreakpoint(stop,request,operation){const error=guard('breakpoints',stop,operation);if(error)return error;if(request.conditions?.length)return failure('unsupported-operation','Conditions unavailable');if(!address(request.address))return failure('invalid-request','Invalid PC address');if(breakpoints.size>=capabilities.maxBreakpoints)return failure('invalid-request','Breakpoint capacity exceeded');const item=Object.freeze({id:`${id}-bp-${++nextBreakpoint}`,request:Object.freeze({address:request.address})});breakpoints.set(item.id,item);return success(item);},
   async removeBreakpoint(stop,breakpointId,operation){const error=guard('breakpoints',stop,operation);if(error)return error;if(!breakpoints.delete(breakpointId))return failure('invalid-request','Breakpoint is not owned');return success();},
   async reset(stop,operation){const error=guard('reset',stop,operation);if(error)return error;pc=0;memory.fill(0);return invalidated('reset');},
   load:unsupported,
   async close(){if(phase==='closed')return success();phase='closed';current=undefined;breakpoints.clear();const exit=Object.freeze({phase:'closed'});finish(exit);emit({kind:'terminal',exit});listeners.clear();return success();}
  }));
 }});
}
