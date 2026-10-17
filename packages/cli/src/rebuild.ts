import { readFileSync } from "node:fs";
import { basename,dirname,extname,join,resolve } from "node:path";
import { rebuildPreservedTap,SourceDocument } from "@zxcode/core";
import { writeNewOutputs } from "./files.js";
export class RebuildUsageError extends Error {}
export function runRebuild(args:readonly string[]):void {
  let source:string | undefined, reference:string | undefined, output:string | undefined, positional=false;
  for(let i=0;i<args.length;i++) {
    const argument=args[i]!;
    if(!positional && argument === "--") {positional=true;continue;}
    if(!positional && ["--reference","--output","-o"].includes(argument)) {
      const value=args[++i];
      if(value === undefined || value === "") throw new RebuildUsageError(`Missing ${argument} value.`);
      if(argument === "--reference") {if(reference !== undefined) throw new RebuildUsageError("Duplicate --reference.");reference=value;}
      else {if(output !== undefined) throw new RebuildUsageError("Duplicate --output.");output=value;}
    } else if(!positional && argument.startsWith("-")) throw new RebuildUsageError(`Unknown rebuild option ${argument}.`);
    else {if(source !== undefined || argument === "") throw new RebuildUsageError("Expected exactly one source file.");source=argument;}
  }
  if(source === undefined || reference === undefined) throw new RebuildUsageError("Expected source and --reference original.tap.");
  const input=resolve(source);
  const text=new TextDecoder("utf-8",{fatal:true,ignoreBOM:true}).decode(readFileSync(input));
  const result=rebuildPreservedTap(new SourceDocument(input,text),readFileSync(resolve(reference)));
  if(result.kind === "blocked") throw new Error(`Preserved rebuild blocked (${result.reason}): ${result.issues.join("; ")}`);
  const target=resolve(output ?? join(dirname(input),basename(input,extname(input))+".preserved.tap"));
  writeNewOutputs([[target,result.tap.tapBytes]]);
  process.stdout.write(`Wrote ${target} (identical reference TAP bytes; preserved ${result.preservedVariableBytes} saved-variable bytes)\n`);
}
