import assert from "node:assert/strict";
import test from "node:test";
import { ESLint } from "eslint";

const eslint = new ESLint();

for (const [layer, dependency] of [
  ["source", "../syntax/index.js"],
  ["syntax", "../semantic/index.js"],
  ["semantic", "../encoding/index.js"],
  ["encoding", "../syntax/index.js"],
  ["tap", "../semantic/index.js"],
  ["source", "vscode"],
  ["source", "@zxcode/cli"],
  ["source", "node:fs"],
  ["source", "fs"]
]) {
  test(`core boundary rejects ${layer} → ${dependency}`, async () => {
    const [result] = await eslint.lintText(`import "${dependency}";\n`, {
      filePath: `packages/core/src/${layer}/boundary-check.ts`
    });
    assert.ok(result.messages.some((message) => message.ruleId === "no-restricted-imports"));
  });
}

test("syntax may consume source contracts", async () => {
  const [result] = await eslint.lintText('import "../source/index.js";\n', {
    filePath: "packages/core/src/syntax/boundary-check.ts"
  });
  assert.deepEqual(result.messages, []);
});
