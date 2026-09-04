# Releasing

A tag publishes. `.github/workflows/release.yml` runs on `v*`, re-runs every
check that guards the published artifact, packs the packages, publishes them to
npm with provenance, and opens a GitHub Release with the changelog section for
that version attached to the tarballs.

The publish step is retry-safe. If npm accepted some of the immutable versions
before a later step failed, the next run skips those uploads and downloads the
exact registry tarballs for the GitHub Release assets.

Nothing about a release is manual except deciding the version and writing down
what changed.

## Steps

1. Set the version in `packages/core/package.json`,
   `packages/react/package.json` and `packages/element/package.json`. All three
   release together and share a version, so both adapters can depend on an exact
   `@kronajs/core`.
2. In `CHANGELOG.md`, turn the `Unreleased` heading into the version and the
   date, and open a fresh `Unreleased` above it. The heading only has to contain
   the version — `## 0.1.0 — 2026-08-25` is the form used here.
3. `node scripts/release-check.mjs <version>` — the same check the workflow runs
   first. It fails if a package version disagrees with the tag or the changelog
   has nothing to say about it.
4. Commit, then start the release either way — both run the same job:

   **Push a tag**, if you have a checkout with a remote:

   ```bash
   git tag v0.1.0
   git push origin v0.1.0
   ```

   **Or press the button**: Actions → Release → Run workflow, and give it the
   version without the `v`. This is the path from a phone, or from anything
   holding an API token; the workflow creates the tag on the commit it tested,
   so a release started this way is recorded exactly like one started by a tag.

   Either way `release-check` runs first, so a version the packages and the
   changelog do not both agree on stops the run before anything is published.

## What the repository needs once

- **A trusted publisher on every npm package** — `kronajs` and `@kronajs/core`
  each authorize GitHub Actions from `critow/krona`, workflow filename
  `release.yml`, for `npm publish`. The workflow's `id-token: write` permission
  lets npm exchange GitHub's OIDC identity for a short-lived publish credential;
  no `NPM_TOKEN` repository secret is used.
- **Publishing access set to disallow bypass-2FA tokens** on every package.
  Trusted publishing continues to work because it authenticates with OIDC, not
  a traditional npm token.
- **The `@kronajs` scope** must exist on npm and the publishing account must own
  it, or the first `@kronajs/core` or `@kronajs/element` publish is rejected.

## `@kronajs/element`, and why its 0.3.0 has no provenance

All three packages are packed and published by the workflow. The element was
not, for one release: npm configures trusted publishing per package, and a
package that has never been published cannot have a publisher configured for
it — a first version has to arrive some other way. 0.3.0 was published by hand,
so that version alone carries no provenance attestation; the trusted publisher
was added afterwards and every version since is signed like the others.

Nothing here needs doing again. It is written down because the same wall stands
in front of any future package added to this repository, and the way past it is
not obvious: publish once by hand, then configure the publisher, then add it to
the Pack and Publish steps.

## Why packing and publishing are two tools

`pnpm pack` resolves `workspace:*` and `catalog:` into the versions a consumer
will actually install; npm cannot do that. `npm publish` authenticates through
OIDC and automatically attaches the provenance attestation; pnpm has no trusted
publishing flow. So the tarball comes from one and the upload from the other.
