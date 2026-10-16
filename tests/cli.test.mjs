import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const entryPoint = fileURLToPath(new URL("../packages/cli/bin/zxcode.mjs", import.meta.url));

for (const args of [[], ["--help"], ["-h"], ["help"]]) {
  test(`CLI help succeeds: ${JSON.stringify(args)}`, () => {
    const result = spawnSync(process.execPath, [entryPoint, ...args], { encoding: "utf8" });
    assert.ifError(result.error);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /Usage: zxcode/);
    assert.match(result.stdout, /1982 BASIC/);
    assert.equal(result.stderr, "");
  });
}

for (const [args, status] of [[["check", "missing.bas"], 1], [["build", "missing.bas"], 1], [["--unknown"], 2], [["--help", "extra"], 2]]) {
  test(`invalid invocation fails: ${JSON.stringify(args)}`, () => {
    const result = spawnSync(process.execPath, [entryPoint, ...args], { encoding: "utf8" });
    assert.ifError(result.error);
    assert.equal(result.status, status);
    assert.equal(result.stdout, "");
    assert.ok(result.stderr.length > 0);
  });
}
