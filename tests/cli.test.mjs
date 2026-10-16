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

for (const args of [["check", "missing.bas"], ["build", "missing.bas"], ["--unknown"], ["--help", "extra"]]) {
  test(`unsupported arguments fail: ${JSON.stringify(args)}`, () => {
    const result = spawnSync(process.execPath, [entryPoint, ...args], { encoding: "utf8" });
    assert.ifError(result.error);
    assert.equal(result.status, 1);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /zxcode --help/);
  });
}
