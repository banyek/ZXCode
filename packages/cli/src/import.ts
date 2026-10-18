import { createHash } from "node:crypto";
import { readFileSync, openSync, writeFileSync, closeSync, unlinkSync } from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import { importTapSource, readBasicTap } from "@zxcode/core";
export class ImportUsageError extends Error {}
const hash = (input:Uint8Array | string):string => createHash("sha256").update(input).digest("hex");
export function runImport(args:readonly string[]):void {
  let input:string | undefined, output:string | undefined, sourceOnly = false, positional = false;
  for(let i=0;i<args.length;i++) {
    const argument=args[i]!;
    if (!positional && argument === "--") {positional=true;continue;}
    if (!positional && (argument === "--output" || argument === "-o")) {
      if(output !== undefined || args[i+1] === undefined || args[i+1] === "") throw new ImportUsageError("Missing or duplicate import output.");
      output=args[++i]!;
    } else if (!positional && argument === "--source-only") {
      if(sourceOnly) throw new ImportUsageError("Duplicate --source-only option.");sourceOnly=true;
    } else if (!positional && argument.startsWith("-")) throw new ImportUsageError(`Unknown import option ${argument}.`);
    else {if(input !== undefined || argument === "") throw new ImportUsageError("Expected exactly one input TAP file.");input=argument;}
  }
  if(input === undefined) throw new ImportUsageError("Expected an input TAP file.");
  const inputPath=resolve(input), bytes=readFileSync(inputPath);
  const imported=importTapSource(bytes,{variables:sourceOnly ? "source-only" : "reject"});
  if(imported.kind === "blocked") throw new Error(`TAP import blocked (${imported.reason}): ${imported.issues.join("; ")}`);
  const parsed=readBasicTap(bytes);
  if(parsed.kind === "error") throw new Error("Validated TAP unexpectedly became unreadable.");
  const outputPath=resolve(output ?? join(dirname(inputPath),basename(inputPath,extname(inputPath))+".zxbas"));
  const reportPath=outputPath+".import.json";
  const report=JSON.stringify({schemaVersion:1,inputFile:basename(inputPath),tapSha256:hash(bytes),programSha256:hash(parsed.programData.slice(0,imported.metadata.variablesOffset)),sourceSha256:hash(imported.source),guarantee:imported.guarantee,variablesPolicy:sourceOnly ? "source-only" : "reject",...imported.metadata},null,2)+"\n";
  const created:string[]=[];
  try {
    for(const [path,content] of [[outputPath,imported.source],[reportPath,report]]) {
      const fd=openSync(path!,"wx");created.push(path!);
      try {writeFileSync(fd,content!,"utf8");} finally {closeSync(fd);}
    }
  } catch(error) {
    for(const path of created.toReversed()) unlinkSync(path);
    throw error;
  }
  if(imported.metadata.omittedVariableBytes > 0) process.stderr.write(`Source-only import omitted ${imported.metadata.omittedVariableBytes} saved-variable bytes; original TAP is unchanged.\n`);
  process.stdout.write(`Wrote ${outputPath}\nWrote ${reportPath}\n`);
}
