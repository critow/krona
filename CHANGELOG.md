# Changelog

Notable changes to Krona. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project follows
[semantic versioning](https://semver.org/spec/v2.0.0.html).

## Unreleased

### Added

- The diff's view logic is framework-free too: `buildRowIndex`, `hasFoldAt`,
  `foldEndRow`, `displayItems` and `unifiedEntries`, with `DisplayItem`,
  `RowIndex` and `UnifiedEntry`. This is the answer to what a diff shows once
  folding and collapsing are applied — including why folding one side hides the
  matching rows on the other — and none of it was ever about components.

  Two of these were tested through a browser only because that is where they
  happened to live. They are Node tests now, and faster for it.

- More of the view state is framework-free. The undo history — `EditHistory`,
  `emptyHistory`, `withEdit`, `withUndo`, `withRedo` — and the search ordering —
  `indexByLine`, `hitsInRowOrder`, `hitFrom` — are in `@kronajs/core` now. Both
  were transitions over plain values written inside React hooks; undo/redo in
  particular is the sort of thing every binding would otherwise rewrite, and it
  is exactly the sort of thing that should not be rewritten twice.

  The transitions answer with the very object they were handed when there is
  nowhere to go, so a view can compare by reference and a dead key press costs
  no render.

- `check-docs` reads the core's exported functions. It walked props interfaces
  and CSS variables only, so a core export could always land undocumented — and
  34 of them had. Those are listed as a baseline the check ignores; everything
  else, and everything added from now on, has to be documented in both
  languages. The list may only shrink.

- The folding logic lives in `@kronajs/core`, where nothing about it needed
  React in the first place: `collapsedToDepth`, `allCollapsed`, `visibleLines`
  and `nestingLevelAt`. It is the first slice of the view state moving out of
  the hooks — the half that is pure functions over a document — and it is worth
  moving whatever else is ever built on top: it is testable in Node rather than
  only in a browser, and it is the answer to what a folded document looks like,
  which is the question the whole library is about.

- The document is walked with the keyboard. Tab enters it once — only the row
  the reader stands on is tabbable — and the arrow keys move line by line, open
  and close blocks, and step out to the block that contains a line; Home and End
  reach the ends. Rows are `role="treeitem"` carrying the nesting the folding
  ranges describe, so a screen reader can say how deep a line sits and whether
  its block is open. The depth is computed from the ranges by difference array,
  one pass per document, because the nesting is in the folding ranges rather
  than in the markup: rows are a flat, virtualized list.

  The gutter chevrons keep their names, their state and their clicks, but they
  are no longer tab stops. Tabbing chevron by chevron was never navigation, and
  since rows are virtualized it could not reach the ones off screen at all.

- The deployed demo carries its own markup. It is a client-rendered app, so what
  a crawler fetched was an empty `<div id="root">` and a script tag — Google runs
  the script eventually, but Bing, the social scrapers and the crawlers behind
  LLM search read what they were handed and move on. `pnpm build:demo` renders
  the built page once in Chromium and writes it back, turning 42 bytes of body
  into ~2.5k characters of text, and refuses to write a page that came back
  empty. Krona's own stylesheet is captured with it, so the static markup
  arrives styled rather than flashing.

  The screenshot suite now runs against that same artifact rather than a plain
  build. React mounts over markup that is already there, and nothing else would
  notice if that stopped working.

### Fixed

- The demo overwrote its own `<title>` on boot: the tab and every search result
  showed the page headline, not the title in `index.html`. The tab and the
  headline are separate strings now — a heading can be a claim, but a title is
  read in a list of results, so it names the formats someone was searching for.

### Changed

- The package descriptions and keywords name what people search for. `kronajs`
  described itself with `Fold, diff and edit…` and carried neither `json` nor
  `viewer` as a keyword, while `@kronajs/core` — the package nobody looks for on
  its own — carried both. The React package now leads with the nouns (collapsible
  tree view, side-by-side diff, in-place editing) and lists the formats, and the
  core names the sibling it belongs to, which `Framework-agnostic core for Krona`
  could not: there is no package called `Krona` on npm.

  The README taglines are unchanged. They are read by people, not by an index,
  and the line they already had is the better one.

- The demo page carries a canonical URL, `og:site_name`, the social card's
  dimensions and alt text, a `robots.txt` and a one-URL `sitemap.xml`. Its title
  and meta description lead with what the thing is rather than with the brand —
  the first words of a snippet are the valuable ones, and nobody searches for
  `Krona`.

## 0.1.2 — 2026-09-02

### Fixed

- A release run could not be retried past its last step. Publishing already
  refuses to reissue a version and downloads the published tarball instead, but
  the GitHub Release was created blindly, so a re-run of a tag that had got
  that far died on `release already exists` — and so did a tag cut from
  GitHub's own release UI, which publishes the release before the workflow
  starts. The step now updates an existing release instead of failing.

  The published packages are byte-identical to `0.1.1`; only the release
  pipeline changed.

## 0.1.1 — 2026-08-30

### Changed

- The React package is published as `kronajs`. npm refused to register `krona`,
  holding it too close to `klona`, `koa`, `cron`, `irone` and `konva`; the name
  belongs to nobody, but its policy is not something a release can argue with.
  The import is `kronajs`, the subpaths are `kronajs/yaml` and
  `kronajs/styles.css`, and the core keeps the name it published under,
  `@kronajs/core`. Nothing about the API moved.

### Fixed

- The publish step passed a tarball as `packs/name.tgz`, which npm read as the
  GitHub shorthand `owner/repo` and tried to clone; the path is `./packs/` now.
  Publishing is also idempotent — a version already on the registry is skipped
  rather than failing the run, so a release that stops halfway can be finished
  instead of abandoned to the next version.

## 0.1.0 — 2026-08-29

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
- Framework-free core (`@kronajs/core`) with structured-clone-safe snapshots for
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
- Search, in both modes: `showSearch` puts a field above the document, or
  `Krona.Search` goes wherever a custom layout wants it. Matching is literal
  rather than a pattern — a regular expression from a text field is one a
  stranger can type too — case-insensitive by default, and capped at 5000
  matches, after which the counter says the number is a floor. Jumping opens
  whatever hides the match, a folded block or a collapsed run of unchanged
  lines, and scrolls it into view. In a diff both versions are searched and the
  matches are ordered by row, so walking them reads down the screen.
  `useKronaSearch()` exposes the state, and `findMatches` in the core does the
  matching without any UI.
- A unified diff: `<Krona.Diff view="unified">` puts both versions in one
  column, old line above new, and `Krona.Unified` is the part it renders. It is
  the same alignment the two panels share, read as one column — a changed row
  becomes two rows, a row only one version has stays one, and the spacers that
  keep two panels level disappear along with the second column. Folding,
  expanding, word-level highlights and the row actions behave as they do side by
  side. `view="auto"`, the default, turns unified below `narrowWidth`, which is
  a better answer on a phone than showing one version at a time.

### Fixed

- Format providers survive a production build. Both packages declared
  themselves side-effect-free while the providers registered themselves from
  module scope, so bundlers dropped every registration: shipped builds rendered
  documents as unhighlighted plain text with nothing to fold, while the dev
  server, the unit tests and the screenshot suite all stayed green. The entry
  point now registers the built-in formats through bindings it holds, the
  `sideEffects` fields name the modules that really do have side effects (so
  `import 'kronajs/yaml'` survives too), and the screenshot suite runs against a
  built and previewed bundle rather than the dev server.

### Performance

- Anchored diff: the input is split at lines unique to both sides and Myers
  runs per segment. A 60k-line lockfile went from ~1.5 s to ~62 ms.
- YAML validation is bounded by `maxValidatedLength`, which took a 67 KB
  lockfile from 51 ms to 6.5 ms.
- Rows are virtualized and lines are tokenized lazily, one line at a time.
