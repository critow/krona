# Changelog

Notable changes to Krona. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project follows
[semantic versioning](https://semver.org/spec/v2.0.0.html).

## Unreleased

### Added

- Linking to a line works in a diff. `selectedLine` and `selectedSide` name a
  line and the version it belongs to — `'right'` by default, since that is what
  a diff is usually read for — and `onSelectLine` reports both, which also puts
  the link action on every row.

  The link names a line; what it opens is the **aligned row** that line sits on.
  Both panels come to rest on the same comparison and each marks its own side of
  it, which is what a reader following a link into a diff came to see.

  That is why the link carries a line and a side rather than a row number. A row
  number is the one figure that appears nowhere on screen — the gutter numbers
  lines, not rows — so it can be neither read off nor checked, and it moves when
  either version or the comparison settings change. A line number is in the
  gutter and stays put. The demo writes `#L42` for the previous version and
  `#R42` for the current, the way GitHub does.

### Fixed

- **The custom element's narrow layout did not work.** It set `hidden` on the
  panel it meant to put away, and `.krona-panel` sets `display: flex`, which
  outranks the browser's rule for `hidden` — so on a narrow screen both panels
  stayed on top of each other and the version switch was visible at every width.
  It shipped that way in 0.3.0.

  The panels are attached and detached now instead. A panel that is not in the
  document cannot be seen, and cannot go on painting rows nobody asked for.

  The test that should have caught this asserted `panel.hidden === true`, which
  is reading back the property the code had just set: it could not have failed.
  It now asks whether the panel is in the document at all.

### Changed

- `@kronajs/element` is packed and published by the release workflow again, now
  that it exists on npm and has a trusted publisher. Its 0.3.0 stays the one
  version without a provenance attestation, for the reason that release records.

- The roadmap says where the project actually stands. It still described 0.1 —
  one file or two, editing and search — and knew nothing of the element, the
  patch export or line links. It is the first thing someone reads when deciding
  whether to take the library, so it is worth keeping honest: what is missing
  from the custom elements is now listed there rather than only in their own
  README.

- Coverage stops measuring files that only re-export a name. Whether a
  forwarding line "runs" says nothing the type checker has not already answered.
  The effect on the figures is 0.01 of a point — this is for consistency, not
  because the numbers were wrong: the React package's format shims were already
  excluded and the element's were not.

## 0.3.0 — 2026-09-02

Krona has a second renderer. Everything it knows about a configuration file
already lived in a core with no framework in it; this release puts a pair of
custom elements on top of that, so the viewer and the diff work outside React.

**`@kronajs/element` 0.3.0 was published by hand, and carries no provenance
attestation.** npm configures trusted publishing per package, and a package that
has never been published cannot have a publisher configured for it, so a first
version has to arrive some other way. The publisher was added afterwards; every
version after this one is signed like the other two.

### Added

- **`@kronajs/element` — Krona as a custom element.** `<krona-viewer>` renders
  the same document model, folding, tokenizing and virtualization as the React
  package, with no framework in it: it works in Vue, Svelte, Angular, Astro, or
  an HTML file with a script tag.

  ```html
  <krona-viewer format="yaml" collapsed-depth="2"></krona-viewer>
  ```

  The document is a property rather than an attribute — a file is not something
  a page wants in its markup — though `source` works as an attribute too.
  Attributes cover `format`, `theme`, `locale`, `line-height`,
  `collapsed-depth`, `overscan`, `selected-line` and `show-diagnostics`;
  `expandAll()`, `collapseAll()` and `revealLine(n)` are methods, and folding a
  block fires `krona-fold`.

  It carries the stylesheet into its own shadow root. That needed no new CSS:
  the theme variables were already declared on `.krona` rather than on `:root`,
  which is the one thing that would have kept them out of a shadow tree.

  `<krona-diff>` compares two versions with the same alignment, word-level
  highlighting and hidden-run collapsing. Both panels render one shared row list
  at one fixed row height, so folding a block hides it on both sides and the two
  scroll in exact lockstep rather than by a ratio.

  The arrow keys walk the document the same way they do in React: Tab enters the
  tree once, ↑ / ↓ move by row, → opens a folded block and then steps into it, ←
  closes one and then walks out to its parent.

  Below `narrow-width` the diff shows one version at a time with a switch
  between them, measuring the element's own width rather than the window's: a
  diff in a sidebar on a wide screen is just as cramped as one on a phone, and a
  media query cannot tell the difference.

  Searching, editing, row actions, the minimap and the unified one-column diff
  stay `kronajs` only for now.

  The demo has [a page with no framework on
  it](https://critow.github.io/krona/element.html), which is the proof rather
  than the claim: the React playground would pass while the elements were broken
  in every way that matters. Its bundle is 41 kB to the React page's 278 kB.

- Two things moved to make room for a second renderer. `KronaLabels`,
  `createDefaultLabels` and `resolveLabels` are core exports now — plain strings
  with no DOM in them, and a second adapter should not keep its own copy of the
  same English. The stylesheet moved to `styles/krona.css` at the repository
  root: whichever package owned it would have been lending it to the others.
  `kronajs` re-exports the labels, so nothing changes for a React consumer.

- `unifiedPatch` writes the diff out as a patch — the text `diff -u` prints and
  `git apply` reads. It is built from the aligned rows rather than from a fresh
  diff, so it is a patch of what the reader is looking at, and folding or
  collapsed runs do not change it: those hide lines from the eye, not from the
  file.

  Krona pairs a removed line with the one that replaced it, because that is how
  two panels are read. A patch is read down one column, where every tool writes
  a run's removals before its additions, so the pairs are unzipped again on the
  way out.

  The two sides are passed as lines, not as parsed documents: a patch is text,
  with no use for folding ranges, tokens or diagnostics. The lines are the ones
  `diffLines` already carries — `result.left` and `result.right`.

  Re-exported from `kronajs` along with the rest of the diff API, so a React
  app needs no second dependency for it. The demo has a Copy patch button in
  compare mode; what it copies applies with `git apply`.

- Linking to a line. `selectedLine` singles one out — opening a folded block to
  reach it, scrolling to it and marking it — and `onSelectLine` reports the line
  a reader picks, which also puts a link action on the row. Both count from 1,
  the way the gutter counts and the way `#L42` means the forty-second line: a
  prop that made you subtract one would be wrong more often than right.

  What the link looks like stays with the host. Krona does not know the page's
  URL and does not invent one; the demo writes `#L42` into the address bar,
  which is where a reader copies a link from anyway.

  Viewer only. A link into a diff would have to name a version as well, and
  that question has more than one reasonable answer.

- A release can be started by hand: Actions → Release → Run workflow, with the
  version. The job is the one a tag push runs, and it creates the tag on the
  commit it tested, so a release cut this way is recorded like any other. A tag
  can only be pushed from a machine with a git remote; a button is reachable
  from a phone.

- Coverage is measured, over both test suites at once: `pnpm test:coverage`,
  and `pnpm verify` now runs it. Half of Krona is exercised from node and half
  from a real browser, so a per-suite figure would call the core's React callers
  uncovered and the React package's core imports uncovered, when between them
  they are not.

  The thresholds are a floor set just under where the suite stands today —
  statements 91, branches 84, functions 92, lines 94 against 93.5, 86.1, 94.2
  and 96.3. They exist to catch a feature landing untested, not to be polished.

  What the report found was worth having, twice over. Every public hook
  documents where it may be called and throws a named error anywhere else, and
  not one of those messages was tested — that message is the first thing a
  consumer composing their own parts sees, so it is part of the API.

  And jumping to a search match in a diff turned out to be the least-tested path
  in the library, though it is the hardest one: a match can be hidden inside a
  folded block *and* inside a collapsed run of unchanged lines, and reaching it
  has to undo whichever applies. `Krona.Diff` went from 54.5% of its branches to
  72.7% on that one addition.

### Fixed

- Two slow tests no longer fail for being watched. The deep-nesting fuzz test
  parses nine megabytes of pathologically nested YAML, and the bundling tests
  each run a real production build; under coverage instrumentation both crossed
  vitest's default five-second timeout. The timeouts are raised. Neither test
  does less work than before — a test made cheaper to keep it green stops being
  the test that was written.

## 0.2.0 — 2026-09-02

Krona can be operated from the keyboard, and most of what it knows now lives in
the framework-free core rather than in React hooks.

**One thing behaves differently:** the fold chevrons in the gutter are no longer
tab stops. They keep their names, their state and their clicks — the document
itself is a single tab stop now, walked with the arrow keys, which is the change
that makes a long file navigable at all.

### Added

- The core's whole public surface is documented, in both languages. Thirty-four
  exports had never been written down — `applyEdit`, `detectFormat`,
  `registerFormat`, `splitLines` and thirty more — which mattered little while
  the core was an implementation detail and matters a great deal now that it is
  where the view logic lives. `docs/reference.md` gains a Core API section
  grouped by what each part is for; the README keeps the short list you reach
  for first.

  With the backlog paid, `check-docs` no longer carries a baseline to ignore: it
  checks every core export, and nothing new can land undocumented. 133 names
  checked before, 167 now.

- Painting a line is framework-free: `buildSegments` splits a line into the
  smallest runs that are uniform across all four overlays — syntax tokens,
  word-level diff highlights, search matches and characters that must never
  reach the page as themselves — and `contentColumnsOf` gives the width to
  reserve so the horizontal extent does not shift while scrolling. Doing the
  merge as data is also why a renderer only ever emits plain text: there is no
  place where document content could become markup.

  With these, `packages/react/src/render/` is gone entirely.

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
