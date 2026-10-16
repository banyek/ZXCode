import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, linkSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { buildTap, checkProgram, M1_BASIC_BYTE_LIMIT, SourceDocument } from "@zxcode/core";

const entry = fileURLToPath(new URL("../packages/cli/bin/zxcode.mjs", import.meta.url));
const hello = '10 PRINT "HELLO WORLD"\n';
function workspace(t) {
  const path = mkdtempSync(join(tmpdir(), "zxcode-cli-"));
  t.after(() => rmSync(path, { recursive: true, force: true }));
  return path;
}
function run(cwd, ...args) {
  const result = spawnSync(process.execPath, [entry, ...args], { cwd, encoding: "utf8" });
  assert.ifError(result.error);
  return result;
}

test("check creates no TAP and default build writes beside the source", (t) => {
  const dir = workspace(t);
  const source = join(dir, "hello.bas");
  writeFileSync(source, hello);
  assert.equal(run(dir, "check", "hello.bas").status, 0);
  assert.deepEqual(readdirSync(dir), ["hello.bas"]);
  const result = run(tmpdir(), "build", source);
  assert.equal(result.status, 0, result.stderr);
  const bytes = readFileSync(join(dir, "hello.tap"));
  const expected = readFileSync(new URL("./fixtures/hello-program.hex", import.meta.url), "utf8").replace(/\s/g, "");
  assert.equal(bytes.subarray(24, -1).toString("hex"), expected);
  assert.equal(bytes.readUInt16LE(16), 0x8000);
});

test("explicit output/name/autostart options control TAP metadata", (t) => {
  const dir = workspace(t);
  writeFileSync(join(dir, "long-source-name.bas"), hello);
  const result = run(dir, "build", "long-source-name.bas", "-o", "chosen.tap", "--name", "HELLO", "--autostart", "10");
  assert.equal(result.status, 0, result.stderr);
  const bytes = readFileSync(join(dir, "chosen.tap"));
  assert.equal(bytes.subarray(4, 14).toString("ascii"), "HELLO     ");
  assert.equal(bytes.readUInt16LE(16), 10);
  assert.equal(bytes.readUInt16LE(18), 19);
  assert.equal(existsSync(join(dir, "long-source-name.tap")), false);
});

test("fatal diagnostics agree between check/build and preserve previous artifacts", (t) => {
  const dir = workspace(t);
  writeFileSync(join(dir, "bad.bas"), '10 PRINT "😀"');
  writeFileSync(join(dir, "bad.tap"), "previous artifact");
  for (const command of ["check", "build"]) {
    const result = run(dir, command, "bad.bas");
    assert.equal(result.status, 1);
    assert.match(result.stderr, /bad\.bas:1:11: error ZX2001 \[compatibility\]/);
  }
  assert.equal(readFileSync(join(dir, "bad.tap"), "utf8"), "previous artifact");
});

test("usage and metadata failures create no artifacts", (t) => {
  const dir = workspace(t);
  writeFileSync(join(dir, "hello.bas"), hello);
  for (const args of [["check"], ["check", "hello.bas", "--output", "x.tap"], ["build", "hello.bas", "--name", "too-long-for-header"], ["build", "hello.bas", "--name", "😀"], ["build", "hello.bas", "--autostart", "10000"], ["build", "hello.bas", "--autostart", "10\n"], ["build", "hello.bas", "--output"]]) {
    assert.equal(run(dir, ...args).status, 2, JSON.stringify(args));
  }
  assert.deepEqual(readdirSync(dir), ["hello.bas"]);
});

test("source destinations and hardlink aliases cannot overwrite input", (t) => {
  const dir = workspace(t);
  writeFileSync(join(dir, "hello.bas"), hello);
  linkSync(join(dir, "hello.bas"), join(dir, "alias.tap"));
  for (const output of ["hello.bas", "alias.tap"]) {
    const result = run(dir, "build", "hello.bas", "--output", output);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /source file/);
    assert.equal(readFileSync(join(dir, "hello.bas"), "utf8"), hello);
  }
});

test("invalid UTF-8 fails without replacement characters or TAP output", (t) => {
  const dir = workspace(t);
  writeFileSync(join(dir, "bad.bas"), Buffer.from([0xff, 0xfe]));
  assert.equal(run(dir, "build", "bad.bas").status, 1);
  assert.equal(existsSync(join(dir, "bad.tap")), false);
});

test("core check/build share encoding-limit diagnostics and do no host I/O", () => {
  const source = new SourceDocument("oversize.bas", '10 PRINT "' + "A".repeat(M1_BASIC_BYTE_LIMIT) + '"');
  const options = { filenameBytes: Uint8Array.from([65, 32, 32, 32, 32, 32, 32, 32, 32, 32]), autostart: 0x8000 };
  const checked = checkProgram(source);
  const built = buildTap(source, options);
  assert.equal(checked.kind, "error");
  assert.equal(built.kind, "error");
  assert.deepEqual(checked.diagnostics, built.diagnostics);
  assert.equal(checked.diagnostics[0].code, "ZX2004");
});
