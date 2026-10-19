# Publishing a VSIX release

Maintainer instructions. Users can download published packages from
[GitHub Releases](https://github.com/banyek/ZXCode/releases); see the
[installation guide](../README.md#install).

To prepare a release, use Node 24 and update the extension version and
lockfile on a release preparation branch:

```sh
npm version 0.1.1 --workspace packages/extension --no-git-tag-version
npm run check
npm run package:extension
node scripts/verify-extension-package.mjs
```

Commit `packages/extension/package.json` and `package-lock.json`, merge the
validated change into `main`, and wait for main CI to pass. Then tag that commit:

```sh
git switch main
git pull --ff-only origin main
git tag -a v0.1.1 -m "ZXCode 0.1.1"
git push origin v0.1.1
```

The **Release VSIX** workflow checks out the tag, builds/packages/verifies on one
Ubuntu runner, and publishes the VSIX and report to the GitHub Release. It runs
only when a `v*` tag is pushed. Tags must use stable `vMAJOR.MINOR.PATCH` versions
and exactly match the committed extension manifest; mismatches fail before
packaging. Other workspace versions do not need to change. The commands use
`0.1.1` as the next release example; replace it consistently for later releases.
Do not recreate the already published `v0.1.0` tag. No Marketplace publication
or PAT is used.

