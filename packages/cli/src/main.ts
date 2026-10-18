import { runImport, ImportUsageError } from "./import.js";
import { readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import { buildTap, checkProgram, SourceDocument, spectrumLiteralByte } from "@zxcode/core";
import type { Diagnostic } from "@zxcode/core";

const help = `ZXCode — 1982 BASIC. 2026 developer experience.

Usage: zxcode check <file>
       zxcode build <file> [options]
       zxcode import <file.tap> [--output path.zxbas] [--source-only]
       zxcode --help

Build options:
  --output, -o <path>  Output TAP path (default: beside the source)
  --name <name>        Spectrum filename (1..10 characters)
  --autostart <line>   Start at BASIC line 1..9999 (default: no autostart)

Exit codes: 0 success, 1 source/build/I/O failure, 2 invalid usage.
`;

class UsageError extends Error {}

interface Options {
  command: "check" | "build";
  file: string;
  output?: string;
  name?: string;
  autostart: number;
}

function parseOptions(args: readonly string[]): Options {
  const command = args[0];
  if (command !== "check" && command !== "build") throw new UsageError("Expected check or build. Run zxcode --help for usage.");
  let file: string | undefined;
  const values = new Map<string, string>();
  let positional = false;
  for (let index = 1; index < args.length; index++) {
    const argument = args[index]!;
    if (!positional && argument === "--") { positional = true; continue; }
    if (!positional && argument.startsWith("-")) {
      const option = argument === "-o" ? "--output" : argument;
      if (command !== "build" || !["--output", "--name", "--autostart"].includes(option)) throw new UsageError(`Unknown option ${argument}. Run zxcode --help for usage.`);
      const value = args[++index];
      if (value === undefined || values.has(option)) throw new UsageError(`Missing or duplicate value for ${option}.`);
      values.set(option, value);
    } else {
      if (file !== undefined) throw new UsageError("Expected exactly one source file.");
      file = argument;
    }
  }
  if (file === undefined || file.length === 0) throw new UsageError("Expected a source file. Run zxcode --help for usage.");
  const line = values.get("--autostart");
  let autostart = 0x8000;
  if (line !== undefined) {
    if (/^[0-9]+$/.exec(line)?.[0] !== line || Number(line) < 1 || Number(line) > 9999) throw new UsageError("Autostart must be a decimal line number from 1 through 9999.");
    autostart = Number(line);
  }
  return { command, file, autostart, ...(values.has("--output") ? { output: values.get("--output")! } : {}), ...(values.has("--name") ? { name: values.get("--name")! } : {}) };
}

function filenameBytes(name: string): Uint8Array {
  const encoded = Array.from(name, (character) => spectrumLiteralByte(character));
  if (encoded.length < 1 || encoded.length > 10 || encoded.some((byte) => byte === undefined)) throw new UsageError("Spectrum filename needs 1..10 directly representable characters; use --name to override it.");
  const bytes = new Uint8Array(10).fill(0x20);
  encoded.forEach((byte, index) => { bytes[index] = byte!; });
  return bytes;
}

function renderDiagnostics(source: SourceDocument, diagnostics: readonly Diagnostic[]): void {
  for (const diagnostic of diagnostics) {
    const position = source.positionAt(diagnostic.range.start);
    process.stderr.write(`${source.id}:${position.line + 1}:${position.column + 1}: ${diagnostic.severity} ${diagnostic.code} [${diagnostic.category}]: ${diagnostic.message}\n`);
    for (const related of diagnostic.related ?? []) {
      const location = source.positionAt(related.range.start);
      process.stderr.write(`  ${related.range.sourceId}:${location.line + 1}:${location.column + 1}: ${related.message}\n`);
    }
  }
}

function protectSource(input: string, output: string): void {
  if (resolve(input) === resolve(output)) throw new Error("Output path must not overwrite the BASIC source file.");
  const inputStat = statSync(input);
  try {
    const outputStat = statSync(output);
    if (inputStat.dev === outputStat.dev && inputStat.ino === outputStat.ino) throw new Error("Output path aliases the BASIC source file.");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

function run(args: readonly string[]): void {
  const command = args[0];
  if (args.length === 0 || (args.length === 1 && command !== undefined && ["--help", "-h", "help"].includes(command))) {
    process.stdout.write(help);
    return;
  }
  if (command === "import") {runImport(args.slice(1));return;}
  const options = parseOptions(args);
  const input = resolve(options.file);
  const text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(readFileSync(input));
  const source = new SourceDocument(input, text);
  if (options.command === "check") {
    const result = checkProgram(source);
    renderDiagnostics(source, result.diagnostics);
    if (result.kind === "error") process.exitCode = 1;
    else process.stdout.write(`${input}: OK\n`);
    return;
  }
  const base = basename(input, extname(input));
  const output = resolve(options.output ?? join(dirname(input), base + ".tap"));
  protectSource(input, output);
  const result = buildTap(source, { filenameBytes: filenameBytes(options.name ?? base), autostart: options.autostart });
  renderDiagnostics(source, result.diagnostics);
  if (result.kind === "error") { process.exitCode = 1; return; }
  writeFileSync(output, result.tap.tapBytes);
  process.stdout.write(`Wrote ${output}\n`);
}

try { run(process.argv.slice(2)); }
catch (error) {
  process.stderr.write(`zxcode: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = error instanceof UsageError || error instanceof ImportUsageError ? 2 : 1;
}
