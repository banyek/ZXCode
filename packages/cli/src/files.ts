import {openSync,writeFileSync,closeSync,unlinkSync} from "node:fs";
/** Exclusive creation and rollback never remove a pre-existing path. */
export function writeNewOutputs(files:readonly (readonly [string,string | Uint8Array])[]):void {
  const created:string[]=[];
  try {
    for(const [path,content] of files) {
      const fd=openSync(path,"wx");created.push(path);
      try {writeFileSync(fd,content);} finally {closeSync(fd);}
    }
  } catch(error) {
    for(const path of created.toReversed()) unlinkSync(path);
    throw error;
  }
}
