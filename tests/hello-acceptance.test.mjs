import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const entry = fileURLToPath(new URL("../packages/cli/bin/zxcode.mjs", import.meta.url));
const source = fileURLToPath(new URL("../examples/hello.bas", import.meta.url));

test("public hello example is the source used to establish the independent bytes", () => {
  assert.equal(readFileSync(source, "utf8"), readFileSync(new URL("./fixtures/hello.bas", import.meta.url), "utf8"));
});

for (const [options, fixture] of [[[], "hello.tap.hex"], [["--autostart", "10"], "hello-autostart.tap.hex"]]) {
  test(`CLI-built hello TAP matches independent complete ${fixture}`, (t) => {
    const directory = mkdtempSync(join(tmpdir(), "zxcode-hello-"));
    t.after(() => rmSync(directory, { recursive: true, force: true }));
    const output = join(directory, "hello.tap");
    const expected = Buffer.from(readFileSync(new URL(`./fixtures/${fixture}`, import.meta.url), "utf8").replace(/\s/g, ""), "hex");
    for (let build = 0; build < 2; build++) {
      const result = spawnSync(process.execPath, [entry, "build", source, "--output", output, ...options], { encoding: "utf8" });
      assert.ifError(result.error);
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stderr, "");
      assert.deepEqual(readFileSync(output), expected);
    }
    assert.equal(expected.length, 44);
  });
}
