import { builtinModules } from "node:module";
import tseslint from "typescript-eslint";

const hostImports = [...builtinModules, "node:*", "vscode", "vscode/**", "@types/vscode", "@zxcode/runner", "@zxcode/runner/**", "**/runner/**", "@zxcode/cli", "@zxcode/cli/**", "**/cli/**", "zxcode-vscode", "zxcode-vscode/**", "**/extension/**", "@zxcode/core"];

function coreBoundary(files, forbiddenLayers = []) {
  return {
    files,
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [
          { group: hostImports, message: "Core must remain independent of editor, CLI, and host I/O APIs; use direct layer imports within core." },
          ...forbiddenLayers.map((layer) => ({
            regex: `(^|/)${layer}(/|$)`,
            message: `This core layer must not depend on ${layer}.`
          }))
        ]
      }]
    }
  };
}

export default [
  { ignores: ["**/dist/**", "**/node_modules/**", "coverage/**", ".vscode-test/**", "artifacts/**"] },
  ...tseslint.configs.recommended,
  coreBoundary(["packages/core/src/**/*.ts"]),
  { files: ["packages/runner/src/**/*.ts"], rules: { "no-restricted-imports": ["error", { patterns: ["vscode", "@types/vscode", "**/extension/**" ] }] } },
  coreBoundary(["packages/core/src/source/**/*.ts"], ["syntax", "semantic", "encoding", "decoding", "tap"]),
  coreBoundary(["packages/core/src/syntax/**/*.ts"], ["semantic", "encoding", "decoding", "tap"]),
  coreBoundary(["packages/core/src/semantic/**/*.ts"], ["encoding", "decoding", "tap"]),
  coreBoundary(["packages/core/src/encoding/**/*.ts"], ["syntax", "decoding", "tap"]),
  coreBoundary(["packages/core/src/decoding/**/*.ts"], ["syntax", "semantic", "encoding", "tap"]),
  coreBoundary(["packages/core/src/tap/**/*.ts"], ["source", "syntax", "semantic", "encoding", "decoding"])
];
