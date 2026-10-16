import { builtinModules } from "node:module";
import tseslint from "typescript-eslint";

const hostImports = [...builtinModules, "node:*", "vscode", "vscode/**", "@types/vscode", "@zxcode/cli", "@zxcode/cli/**", "**/cli/**", "@zxcode/core"];

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
  { ignores: ["**/dist/**", "**/node_modules/**", "coverage/**"] },
  ...tseslint.configs.recommended,
  coreBoundary(["packages/core/src/**/*.ts"]),
  coreBoundary(["packages/core/src/source/**/*.ts"], ["syntax", "semantic", "encoding", "tap"]),
  coreBoundary(["packages/core/src/syntax/**/*.ts"], ["semantic", "encoding", "tap"]),
  coreBoundary(["packages/core/src/semantic/**/*.ts"], ["encoding", "tap"]),
  coreBoundary(["packages/core/src/encoding/**/*.ts"], ["syntax", "tap"]),
  coreBoundary(["packages/core/src/tap/**/*.ts"], ["source", "syntax", "semantic", "encoding"])
];
