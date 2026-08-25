# Changelog

Notable changes to Krona. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project follows
[semantic versioning](https://semver.org/spec/v2.0.0.html).

## Unreleased — `0.1.0`

The first release. Not on npm yet; install from git or run the
[demo](https://critow.github.io/krona/).

### Added

- `<Krona>` config root with `<Krona.Viewer>` and `<Krona.Diff>` modes.
- Format providers for JSON/JSONC, YAML, TOML and INI/.env, each degrading to
  plain text on input it cannot parse.
- Editor-style folding for objects, arrays, YAML blocks, TOML tables and INI
  sections, with `{ N items }` placeholders on the collapsed line.
- Line-based side-by-side diff with word-level highlighting inside changed
  lines and long unchanged runs collapsed behind an expandable bar.
- Composable parts — `Gutter`, `Lines`, `Toolbar`, `Panel`, `Minimap`,
  `ExpandBar` — that read the same line source, so either mode can be laid out
  by hand.
- `useKronaModel`, `useKronaDiff` and `useLineSource` for building on the model
  directly.
- Light and dark themes driven entirely by `--krona-*` custom properties.
- English default labels, all replaceable through the `labels` prop; the
  library ships no i18n runtime and formats numbers with `Intl.NumberFormat`.
- Framework-free core (`krona/core`) with structured-clone-safe snapshots for
  parsing inside a Web Worker.
- Parse limits (`maxInputLength`, `maxDepth`, `maxFoldRanges`,
  `maxTokenizedLineLength`, `maxValidatedLength`) with readable errors instead
  of a hung tab.
- Bidirectional and zero-width characters rendered as visible `U+XXXX` badges.

### Performance

- Anchored diff: the input is split at lines unique to both sides and Myers
  runs per segment. A 60k-line lockfile went from ~1.5 s to ~62 ms.
- YAML validation is bounded by `maxValidatedLength`, which took a 67 KB
  lockfile from 51 ms to 6.5 ms.
- Rows are virtualized and lines are tokenized lazily, one line at a time.
