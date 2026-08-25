# Releasing

A tag publishes. `.github/workflows/release.yml` runs on `v*`, re-runs every
check that guards the published artifact, packs both packages, publishes them to
npm with provenance, and opens a GitHub Release with the changelog section for
that version attached to the tarballs.

Nothing about a release is manual except deciding the version and writing down
what changed.

## Steps

1. Set the version in `packages/core/package.json` and
   `packages/react/package.json`. They release together and share a version, so
   `@krona/core` can be depended on exactly.
2. In `CHANGELOG.md`, turn the `Unreleased` heading into the version and the
   date, and open a fresh `Unreleased` above it. The heading only has to contain
   the version — `## 0.1.0 — 2026-08-25` is the form used here.
3. `node scripts/release-check.mjs <version>` — the same check the workflow runs
   first. It fails if a package version disagrees with the tag or the changelog
   has nothing to say about it.
4. Commit, then tag and push:

   ```bash
   git tag v0.1.0
   git push origin v0.1.0
   ```

## What the repository needs once

- **`NPM_TOKEN`** — a granular automation token with publish rights on `krona`
  and the `@krona` scope, stored as a repository secret. Provenance needs the
  workflow's OIDC token as well, which `permissions: id-token: write` grants;
  the secret only proves who is publishing.
- **The `@krona` scope** must exist on npm and the token's account must own it,
  or the first `@krona/core` publish is rejected.

## Why packing and publishing are two tools

`pnpm pack` resolves `workspace:*` and `catalog:` into the versions a consumer
will actually install; npm cannot do that. `npm publish` attaches the provenance
attestation; pnpm has no flag for it. So the tarball comes from one and the
upload from the other.
