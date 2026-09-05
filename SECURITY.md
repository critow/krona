# Security policy

## Reporting a vulnerability

Please report privately, through GitHub's
[private vulnerability reporting](https://github.com/critow/krona/security/advisories/new),
rather than in a public issue. You will hear back within a few days and get a
fix or a decision within thirty days. Credit goes in the changelog unless you
would rather it did not.

## Supported versions

The latest published minor of `kronajs`, `@kronajs/core` and `@kronajs/element`
gets security fixes. Older versions do not: the three packages release together
and share a version, so upgrading is one bump.

`@kronajs/element@0.3.0` was published by hand without its `dist` directory and
could not be imported at all. Use 0.4.0 or later, which the release workflow
packed, checked and published with a provenance attestation.

## Scope

- The three npm packages, and what they render from a host's documents, labels,
  props and attributes.
- The release pipeline in `.github/workflows`.

The demo at https://critow.github.io/krona/ is a static page: text pasted into
it stays in the browser and is sent nowhere.

## What Krona promises

A file shown in Krona is untrusted input. Content reaches the page as text
nodes only — no `innerHTML`, no autolinking, no attribute built from a
document — and no JavaScript object is ever built from a file, so `__proto__`
and `constructor` are keys like any other. Every parser bound has a default in
`DEFAULT_LIMITS` and an oversized or malformed file degrades to plain text with
a diagnostic. Search is a literal scan, never a regular expression. Bidi
overrides and invisible characters are painted as visible `U+XXXX` badges.

What stays with the host: `labels`, `className`, `style`, `locale` and the file
names given to `unifiedPatch` are trusted — pass them from your own code, not
from a document.
