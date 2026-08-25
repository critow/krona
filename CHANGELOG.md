# Changelog

Notable changes to Krona. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project follows
[semantic versioning](https://semver.org/spec/v2.0.0.html).

## Unreleased — `0.1.0`

The first release. Try it in the [demo](https://critow.github.io/krona/).

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

- Editing in `<Krona.Viewer editable>`: values in place, lines and whole blocks
  as raw text, entry removal, duplication, and undo/redo. Every change is a text edit against
  the source, which is then parsed again, so the model stays an immutable list
  of lines. `onChange` reports the whole document; `useKronaViewer()` exposes it
  along with the history.
- Editing an object or array reshapes it into the layout the file already uses,
  with the indent width read from the document. Text in, text out, through the
  provider — a formatter round-tripping through a parsed value would build the
  object Krona is careful never to build. An edit and its formatting are one
  undo step.
- A narrow layout. Below `narrowWidth` (640px, measured on the root rather than
  the window) a diff shows one panel at a time with a side switch — the new
  `Krona.SideSwitch` part — and the gutter narrows without dropping below the
  44px the fold control needs. `useKronaDiff()` exposes `narrow`, `side` and
  `showSide` for layouts of your own.
- Copy the path to what a line introduces — `server.tls.ciphers[0]` — in every
  format. Providers record the one segment each line adds during the pass they
  already make; the path is assembled from the folding ranges around the line,
  so a document keeps one short string per line rather than a copy of every
  ancestor on every descendant. `DocumentModel.pathAt` exposes it.
- Tooltips on the row actions, and a visible confirmation when a copy lands.
- Copy actions on the hovered row in both modes: the value on its own, and the
  whole entry — the whole block when the line opens one.
- Diff panels scroll in lockstep on both axes, over a content width the whole
  document sets rather than the rows currently on screen.

### Fixed

- Format providers survive a production build. Both packages declared
  themselves side-effect-free while the providers registered themselves from
  module scope, so bundlers dropped every registration: shipped builds rendered
  documents as unhighlighted plain text with nothing to fold, while the dev
  server, the unit tests and the screenshot suite all stayed green. The entry
  point now registers the built-in formats through bindings it holds, the
  `sideEffects` fields name the modules that really do have side effects (so
  `import 'krona/yaml'` survives too), and the screenshot suite runs against a
  built and previewed bundle rather than the dev server.

### Performance

- Anchored diff: the input is split at lines unique to both sides and Myers
  runs per segment. A 60k-line lockfile went from ~1.5 s to ~62 ms.
- YAML validation is bounded by `maxValidatedLength`, which took a 67 KB
  lockfile from 51 ms to 6.5 ms.
- Rows are virtualized and lines are tokenized lazily, one line at a time.
