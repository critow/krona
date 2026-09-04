<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./docs/assets/logo-dark.svg">
  <img src="./docs/assets/logo-light.svg" width="132" height="126" alt="">
</picture>

# Krona

**Fold, diff and edit configuration files — a React component that never turns your file
into an object.**

JSON/JSONC · YAML · TOML · INI/.env

[**Explore the demo →**](https://critow.github.io/krona/)

[English](./README.md) · [Русский](./README.ru.md)

[![CI](https://github.com/critow/krona/actions/workflows/ci.yml/badge.svg)](https://github.com/critow/krona/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-5ccfe6?style=flat-square)](./LICENSE)
[![Runtime dependencies: 5](https://img.shields.io/badge/runtime%20deps-5-5ccfe6?style=flat-square)](#design-notes)
[![Types: included](https://img.shields.io/badge/types-included-5ccfe6?style=flat-square)](./docs/reference.md#props-reference)
[![React 18 | 19](https://img.shields.io/badge/react-18%20%7C%2019-5ccfe6?style=flat-square)](#installation)

</div>

---

- **Folds like an editor.** Objects, arrays, YAML blocks, TOML tables and INI sections collapse from the gutter, with a placeholder saying what is hidden: `{ 3 items }`.
- **Diffs like git.** Line-based, side by side, with word-level highlighting inside changed lines and long unchanged runs folded behind an expandable bar.
- **Composable.** Each mode renders a default layout, or takes apart into the same public parts when you want your own.
- **Editable, as text.** The viewer edits values, lines and whole blocks, with undo and redo. Every change replaces a span of the source and re-parses, so it can never invent syntax the format does not have.
- **Fast on real files.** A 60k-line lockfile parses in ~30 ms and diffs in ~62 ms; rendering is virtualized and tokenizing is lazy.
- **Five packages in the install tree.** `jsonc-parser`, `yaml` and `diff` parse and diff;
  `@tanstack/react-virtual` and its `@tanstack/virtual-core` virtualize. A CI check fails
  the build if a sixth appears. `@kronajs/core` is ours; React is a peer.
- **Safe with untrusted content.** No `innerHTML` anywhere, no JavaScript objects built from your file, bidi and zero-width characters rendered as visible badges.

![Side-by-side diff of two JSON files](./docs/assets/diff-dark.png)

## Contents

- [Installation](#installation)
- [Quick start](#quick-start)
- [Formats](#formats)
- [Reference](#reference) — props, parts, labels, theming, limits
- [Editing](#editing)
- [Custom layouts](#custom-layouts)
- [Hooks](#hooks)
- [Search](#search)
- [Keyboard](#keyboard)
- [Linking to a line](#linking-to-a-line)
- [Small screens](#small-screens)
- [Large files and Web Workers](#large-files-and-web-workers)
- [Without React: `<krona-viewer>` and `<krona-diff>`](#without-react-krona-viewer-and-krona-diff)
- [Using the core without React](#using-the-core-without-react)
- [Design notes](#design-notes)
- [Roadmap](#roadmap)
- [Development](#development)
- [License](#license)

## Installation

```bash
npm install kronajs
```

React 18 or 19 is a peer dependency.

## Quick start

```tsx
import { Krona } from 'kronajs'

// Viewer
<Krona format="yaml" theme="dark">
  <Krona.Viewer source={text} defaultCollapsedDepth={2} />
</Krona>

// Diff
<Krona format="json" theme="dark">
  <Krona.Diff left={before} right={after} collapseUnchanged />
</Krona>
```

Styles are injected automatically. If you render on the server or own your CSS
pipeline, pass `injectStyles={false}` and `import 'kronajs/styles.css'` yourself.

![Viewer showing a YAML file with folded blocks](./docs/assets/viewer-dark.png)

## Formats

Importing `kronajs` registers **JSON/JSONC**, **TOML** and **INI/.env**. YAML sits
behind its own entry point, because the `yaml` parser is tens of kilobytes and
should not land in a bundle that only ever shows JSON:

```tsx
import 'kronajs/yaml'
```

`format="auto"` sniffs the content, but only among providers you actually
imported — it will never resurrect one you chose to leave out. An unknown
format, a malformed file or an oversized input degrades to plain text with a
diagnostic instead of throwing.

| Format | Entry point | What folds |
| --- | --- | --- |
| JSON / JSONC | `kronajs` | Objects and arrays; comments and trailing commas allowed |
| YAML | `kronajs/yaml` | Indentation, block scalars (`\|`, `>`), multi-line flow collections |
| TOML | `kronajs` | `[table]` and `[[array of tables]]`, nested by dotted path; multi-line strings and arrays |
| INI | `kronajs` | `[section]`, nested by dotted name |
| .env | `kronajs` | Nothing — a flat file has nothing to fold, only highlighting |

## Reference

Every prop, part, label, custom property and parse limit lives in
**[docs/reference.md](./docs/reference.md)** — the props of `<Krona>`,
`<Krona.Viewer>` and `<Krona.Diff>`, the parts a custom layout can use, the
labels to translate, the `--krona-*` custom properties and the parse limits.

## Editing

`<Krona.Viewer editable>` turns the document into something the reader can
change. Double-click a value to edit it in place, or use the row actions that
appear on hover: edit the line as raw text, edit a whole block as raw text,
delete the entry, duplicate it. `Enter` commits, `Escape` cancels, and in the
block editor `Ctrl`/`Cmd` + `Enter` commits. Undo and redo are in the toolbar.

New entries are made by **duplicating** one. A copy is the only new entry
guaranteed to be valid where it lands — already an entry of this container,
in this format, at this indentation — so Krona never has to know what a new key
looks like in TOML versus YAML. The copy opens for editing straight away.

```tsx
const [text, setText] = useState(initial)

<Krona format="json">
  <Krona.Viewer source={text} editable onChange={setText} />
</Krona>
```

Editing an object or an array reshapes it into the layout the file already
uses. Type or paste `{"host":"10.0.0.1","port":9090}` into a block editor and
what lands is a block indented like its neighbours — the indent width comes from
the document, not from a setting, because reformatting one block in a style the
rest of the file does not use is worse than not formatting it at all. Only the
edited span is touched; the document around it keeps whatever shape it had. A
value edited in place keeps its line, since re-flowing it would move text you
were not looking at.

Formatting is text in, text out, and it is a provider's job: JSON and JSONC
have it, and a format whose provider offers none leaves edited text exactly as
typed. A formatter that round-tripped through a parsed value would build the
JavaScript object the rest of Krona is careful never to build, and would drop
whatever the format's value model has no room for — comments, in JSON's case.
An edit and the formatting it triggers are one undo step.

Every edit is a **text** edit: it replaces a span of the source, and the result
is parsed again. Nothing is written back through a JavaScript object, so an edit
cannot invent syntax the format does not have — it only moves characters you
typed. That is also why editing works the same in every format: a YAML value and
a TOML value are both a span of text.

Deleting an entry takes its line break with it, and the comma that would be left
dangling before a closing brace, because an edit that reliably produces a syntax
error is not an edit but a trap. Broken input stays visible either way: a
document that no longer parses degrades to plain text with diagnostics, so a
half-finished edit never blanks the view.

The undo history holds inverse edits rather than snapshots, so a hundred steps
on a megabyte file cost a hundred short strings.

The viewer owns the text once `editable` is set, re-seeding whenever `source`
changes. `useKronaViewer()` exposes the current document and the history:

```tsx
const { source, canUndo, canRedo, undo, redo } = useKronaViewer()
```

`<Krona.Diff>` stays read-only. Comparing two versions is a different job from
changing one of them, and a diff has no single document to write to.

**Copying needs no editing.** Both modes offer copy actions on the hovered row —
the value on its own, and the whole entry, which is the whole block when the
line opens one. Turn them off with `<Krona.Lines showCopyActions={false} />`.

A third copy action gives the **path** to what the line introduces —
`server.tls.ciphers[0]` — and the tooltip shows it before you take it. Paths
come from the provider, which records the one segment each line adds while it
is already walking the file; the path itself is assembled from the folding
ranges around the line, so a document keeps one short string per line rather
than a copy of every ancestor on every descendant. All four formats report
them: dotted keys and `[table]` headers in TOML, sections in INI, indentation
and sequence indices in YAML.

A path names a line. A line holding several entries answers with the first, and
a line that introduces nothing of its own — a closing bracket — answers with the
block it sits in.


## Custom layouts

`Krona.Viewer` and `Krona.Diff` render a default layout when given no children.
Supply children and you compose the same public parts yourself; arbitrary JSX
may sit between them.

```tsx
<Krona format="json">
  <Krona.Diff left={before} right={after} collapseUnchanged showMinimap>
    <Krona.Toolbar>
      <button onClick={download}>Download</button>
    </Krona.Toolbar>
    <Krona.Panel side="left">
      <Krona.Gutter />
      <Krona.Lines />
    </Krona.Panel>
    <Krona.Minimap />
    <Krona.Panel side="right">
      <Krona.Gutter />
      <Krona.Lines />
    </Krona.Panel>
  </Krona.Diff>
</Krona>
```

Parts declare where they belong, which is why they can be written as plain
siblings and still end up inside the scroll container they need. A part you
write yourself lands above the content by default.

## Hooks

```tsx
const { model, collapsed, toggleFold, expandAll, collapseAll, visibleLines } = useKronaViewer()
const { source, editable, canUndo, canRedo, undo, redo } = useKronaViewer() // editing
const { alignedRows, visibleRows, stats, expandContext, toggleRowFold } = useKronaDiff()
const { format, theme, labels, lineHeight } = useKronaConfig()
```

Each throws a clear error outside its mode, so a misplaced toolbar fails at the
first render rather than rendering something empty.

```tsx
function ChangeCount() {
  const { stats } = useKronaDiff()
  return <span>{stats.added} added, {stats.removed} removed</span>
}
```

## Search

`showSearch` puts a field above the document, or `Krona.Search` puts one wherever
your layout wants it. Matches are highlighted as you type; Enter and Shift+Enter
walk them, as do the step buttons.

```tsx
<Krona format="yaml">
  <Krona.Viewer source={text} showSearch />
</Krona>
```

**Matching is literal, never a pattern.** A regular expression typed into a text
field is one a stranger can type too, and a viewer that stops answering is worse
than one that finds less. Case is ignored by default; the `Aa` toggle stops that.

Jumping to a match **opens whatever hides it** — a folded block, a collapsed run
of unchanged lines — and scrolls it into view, so a match in a file you are
looking at from a distance is still one keystroke away.

In a diff both versions are searched and the matches are ordered **by row**, so
walking them reads down the screen rather than through one file and then the
other. A line that was removed and the line that replaced it are neighbours.

Long searches stop at 5000 matches; the counter then reads `1 / 5000+`, because a
count nobody will walk is not worth the memory to hold.

`useKronaSearch()` exposes the same state for a control of your own:

```tsx
const { query, setQuery, total, position, next, previous } = useKronaSearch()
```

`findMatches(model, query)` from the core does the matching itself, if you want
the occurrences without the UI.

## Keyboard

The document is a tree, and it is walked like one. Tab enters it once — only the
row you are standing on is tabbable — and the arrow keys do the rest.

| Key | Does |
| --- | --- |
| `↑` `↓` | Previous line, next line |
| `→` | Open a folded block, otherwise move down |
| `←` | Close an open block, otherwise go out to the block containing the line |
| `Enter` `Space` | Fold or unfold the block the line opens |
| `Home` `End` | First line, last line |

Rows carry `role="treeitem"` with the nesting the folding ranges describe, so a
screen reader announces how deep a line sits and whether its block is open. The
chevrons in the gutter stay clickable and keep their names, but they are not tab
stops: rows are virtualized, so tabbing chevron by chevron never reached the
ones off screen anyway.

## Linking to a line

`selectedLine` singles a line out: it opens whatever hides it — a folded block —
scrolls it into view and marks it. `onSelectLine` is the other direction, called
when the reader picks a line out, which also puts a link action on the row.

```tsx
const [line, setLine] = useState(() => Number(/^#L(\d+)$/.exec(location.hash)?.[1] ?? 0))

<Krona format="json">
  <Krona.Viewer
    source={text}
    selectedLine={line}
    onSelectLine={(picked) => {
      setLine(picked)
      history.replaceState(null, '', `#L${picked}`)
    }}
  />
</Krona>
```

Both count from 1, the way the gutter counts and the way `#L42` means the
forty-second line. What the link looks like is yours: Krona does not know your
page's URL and does not invent one.

**In a diff a line names a version too**, so `selectedSide` says which —
`'right'`, the current one, by default, since that is what a diff is usually read
for. `onSelectLine` is handed the side along with the line.

```tsx
<Krona.Diff
  left={before}
  right={after}
  selectedLine={line}
  selectedSide={side}
  onSelectLine={(picked, from) => {
    history.replaceState(null, '', `#${from === 'left' ? 'L' : 'R'}${picked}`)
  }}
/>
```

The link names a line, but what it opens is the **aligned row** that line sits
on: both panels come to rest on the same comparison, and both mark their own
side of it. That is what a reader following a link into a diff came to see — and
it is why the link carries a line and a side rather than a row number. A row
number is the one figure that is nowhere on screen, and it moves when either
version or the comparison settings change; a line number is on the gutter and
stays put.

## Small screens

Below `narrowWidth` (640px by default) a diff turns **unified**: one column, the
old line above the new one. Splitting the width of a phone between two panels
gives about ten characters each, which shows neither version, and switching
between them means holding one in your head — a unified diff puts the whole
width behind one line at a time and keeps both on screen. The gutter narrows too.

`view="split"` keeps two panels at every width; a narrow one then shows a single
side with `Krona.SideSwitch` to change it. `view="unified"` uses one column at
every width.

The width measured is the **root's**, not the window's. A diff in a sidebar on a
wide screen is just as cramped as one on a phone, and a media query cannot tell
the difference. Pass `narrowWidth={0}` to keep the wide layout at every size.

```tsx
<Krona format="json" narrowWidth={480}>
  <Krona.Diff left={before} right={after} />
</Krona>
```

`useKronaDiff()` exposes the same state, for a layout of your own:

```tsx
const { narrow, unified, side, showSide } = useKronaDiff()
```

Row actions stay visible without hovering where there is no pointer to hover
with, so they can be reached by tap.

## Large files and Web Workers

Parsing and diffing are linear passes and both stay well inside a frame budget
for the file this project benchmarks against — two versions of a ~60k line
`package-lock.json`:

| | |
| --- | --- |
| parse 60k lines | ~30 ms |
| diff two 60k-line versions | ~62 ms |
| align the diff | ~70 ms |
| tokenize one viewport | ~29 ms |

Run it yourself with `pnpm bench`.

Above roughly a megabyte, do the work off the main thread. The model is plain
data, so a worker can hand it back:

```ts
// worker.ts
import { parseDocument, toSnapshot } from '@kronajs/core'
import '@kronajs/core/yaml'

self.onmessage = ({ data }) => {
  const model = parseDocument(data.source, data.format)
  self.postMessage(toSnapshot(model))
}
```

```tsx
// app.tsx
import { fromSnapshot } from '@kronajs/core'

const [model, setModel] = useState<DocumentModel>()
useEffect(() => {
  const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
  worker.onmessage = ({ data }) => setModel(fromSnapshot(data))
  worker.postMessage({ source, format: 'yaml' })
  return () => worker.terminate()
}, [source])

return model ? (
  <Krona>
    <Krona.Viewer model={model} />
  </Krona>
) : null
```

Krona does not instantiate the worker for you — worker URLs are
bundler-specific — but `model`, `leftModel` and `rightModel` make that path
first class.

## Without React: `<krona-viewer>` and `<krona-diff>`

Everything Krona knows about a configuration file lives in `@kronajs/core`,
which has no framework in it. `@kronajs/element` renders that as custom
elements, so the viewer and the diff work in Vue, Svelte, Angular, Astro, or an
HTML file with a script tag. There is [a page of the demo with no framework on
it at all](https://critow.github.io/krona/element.html).

```bash
npm install @kronajs/element
```

```html
<krona-viewer id="config" format="yaml" collapsed-depth="2"></krona-viewer>

<script type="module">
  import { defineKrona } from '@kronajs/element'
  import '@kronajs/element/yaml'

  defineKrona()
  document.getElementById('config').source = await fetch('compose.yaml').then((r) => r.text())
</script>
```

Comparing two versions is `<krona-diff>`, with the same alignment, word-level
highlighting and hidden-run collapsing:

```html
<krona-diff id="changes" format="json" collapse-unchanged></krona-diff>
<script type="module">
  const diff = document.getElementById('changes')
  diff.left = before
  diff.right = after
</script>
```

Documents are properties rather than attributes — a file is not something a page
wants in its markup — though `source`, `left` and `right` work as attributes too
for short ones. The rest is attributes: `format`, `theme`, `locale`,
`line-height`, `collapsed-depth`, `overscan`, `selected-line`,
`show-diagnostics`, `show-search`, `show-actions`, `link-lines`, and for the
diff `collapse-unchanged`, `context`, `minimum-hidden`, `step`,
`ignore-trailing-whitespace`, `show-toolbar`, `show-markers`, `show-minimap`,
`view` and `narrow-width`. `expandAll()`, `collapseAll()`, `revealLine(n)` and
`showSide(side)` are methods; folding a block fires `krona-fold`, and picking a
line out fires `krona-select-line`.

Below `narrow-width` the diff shows one version at a time, with a switch between
them — the width of the element itself, not the window's, so a diff in a sidebar
is treated like one on a phone.

Arrow keys walk the document the same way they do in React: Tab enters the tree
once, ↑ / ↓ move by row, → opens a folded block and then steps into it, ← closes
one and then walks out to its parent.

Each element brings the stylesheet into its own shadow root, so nothing on the
page reaches in and nothing leaks out. Theming is unchanged: `--krona-*` custom
properties cross a shadow boundary, so setting them on any ancestor still works.

Per-framework notes — the `isCustomElement` line Vue needs, Angular's
`CUSTOM_ELEMENTS_SCHEMA`, and what changes on React 18 — are in the
[package README](./packages/element/README.md).

**Editing is `kronajs` only for now.** If you need those and can run React, use that
package.

## Using the core without React

```ts
import { parseDocument, diffLines, alignDiff, intralineDiff } from '@kronajs/core'
import '@kronajs/core/yaml'

const doc = parseDocument(source, 'yaml')
doc.lines            // source lines
doc.foldingRanges    // collapsible ranges
doc.tokensAt(12)     // tokens for one line, computed on demand and memoized
doc.diagnostics      // parse problems, never thrown

const { rows, stats } = alignDiff(diffLines(before, after))
```

| Function | Returns |
| --- | --- |
| `parseDocument(source, format?, options?)` | `DocumentModel` — never throws for content reasons |
| `diffLines(left, right, options?)` | `DiffResult` — line runs, plus `approximate` when the budget ran out |
| `alignDiff(result, options?)` | `AlignedDiff` — rows for two panels, with spacers, plus `stats` |
| `intralineDiff(left, right, options?)` | Word-level spans for one changed row |
| `collapseUnchanged(rows, options?)` | Runs worth hiding behind a bar |
| `unifiedPatch(rows, leftLines, rightLines, options?)` | The diff as a unified patch, ready for `git apply` |
| `collapsedToDepth(model, depth?)` | Start lines to fold for an opening depth |
| `allCollapsed(model)` | Start lines of every range — the document fully folded |
| `visibleLines(model, collapsed)` | Line indices still on screen, in order |
| `nestingLevelAt(model, line)` | How deep a line sits, 1 at the top |
| `emptyHistory(source)` | `EditHistory` — text with nothing to undo yet |
| `withEdit(history, edit)` | The history after one more edit; ends the redo branch |
| `withUndo(history)` / `withRedo(history)` | One step back or forward, or the same history when there is nowhere to go |
| `indexByLine(matches)` | `MatchIndex` — matches grouped by the line they sit on |
| `hitsInRowOrder(rows, left, right)` | A diff's hits in the order they appear on screen |
| `hitFrom(hits, position, direction)` | Index of the first hit past a position, wrapping at the ends |
| `buildRowIndex(rows, left, right)` | `RowIndex` — which row shows each line of either version |
| `hasFoldAt(row, rows, left, right)` | Whether either version opens a block on that row |
| `foldEndRow(row, rows, left, right, index)` | Last row a fold there covers, across both sides |
| `displayItems(rows, left, right, index, collapsed, regions)` | `DisplayItem[]` — the rows a diff shows once folding and collapsing are applied |
| `unifiedEntries(items, rows)` | `UnifiedEntry[]` — the same alignment read as one column |
| `buildSegments(text, tokens, intraline, whole, matches?, current?)` | `Segment[]` — the runs a line splits into once tokens, word-level highlights, search matches and unsafe characters are merged |
| `contentColumnsOf(...models)` | Width to reserve, in characters, so the horizontal extent does not shift while scrolling |
| `scanUnsafeCharacters(text)` | Bidi and invisible characters, with positions |
| `toSnapshot` / `fromSnapshot` | Structured-clone-safe projection, for workers |

## Design notes

**The name is the canopy of a tree, not a monarch's crown.** Krona shows a
document as a tree you fold branch by branch; a canopy is the shape of the whole
before you look at any one branch, which is what a folded configuration file
gives you. The mark says both halves of that: a file folded into a tree of rows,
with the two signs of a diff beside them, growing into a tree. It lives in
`docs/assets` — `logo-light.svg` and `logo-dark.svg` are the mark, `logotype-*`
add the wordmark, and `logo.svg` picks a palette from the reader's own theme. The
demo sets its own name in Krona Sans, a one-weight face carrying the wordmark's
letters (OFL, derived from Comfortaa; the licence ships beside the font). It
names the product and stops there — every other word on the page is monospace,
because the page is about reading configuration files.

**The model is lines, not a value tree.** Diffing is line based and folding is
range based, so `lines + folding ranges` serves both. Krona never builds a
JavaScript object out of your file, which is why prototype pollution through a
`__proto__` key does not apply here.

**Reordering keys is a real difference.** Krona compares text, exactly like git.
A semantic diff would hide changes that matter in a configuration file.

**Dangerous characters are shown, not rendered.** Bidirectional overrides
([Trojan Source](https://trojansource.codes/), CVE-2021-42574) and zero-width
characters are painted as visible `U+XXXX` badges. A diff that renders them
verbatim can show two different files as identical.

**Both panels scroll as one, on both axes.** Rows are a fixed height and the
panels share a row list, so vertical sync is an exact `scrollTop` copy rather
than a ratio. Horizontally both panels reserve the width of the widest line in
*either* document, so column *n* is at the same offset on both sides — reading
the same column on the left and the right is the whole point of a side-by-side
diff.

**No `innerHTML`, anywhere.** Content is emitted as React text nodes; the rule is
enforced by the linter.

**Aliases are never expanded.** A YAML "billion laughs" file costs no more than
its own size.

## Roadmap

Krona shows one configuration file, or two of them — side by side or in one
column — lets you [edit](#editing) the single file and [search](#search) either,
[links to a line](#linking-to-a-line) — in one document or in a comparison —
and writes a diff out as a [unified patch](#reference). It does that in React, and the viewer and diff
[without a framework](#without-react-krona-viewer-and-krona-diff) as well.

Everything below is deliberately absent rather than forgotten.

| Not here yet | Reasoning | Likely |
| --- | --- | --- |
| Editing in the custom elements | The element is the reading half so far. Each of these is real work rather than a port, and the React package covers anyone who can run React. | Yes, in order of who asks |
| More formats (JSON5, XML, `.properties`, HCL) | Each is a provider — an `analyze` and a `tokenize` — behind the same interface. Waiting for someone to actually need one. | Maybe |
| Semantic diff | Reordering keys *is* a difference in a configuration file. Krona compares text, exactly like git. | Not planned |

Issues and pull requests are welcome. See [Development](#development) for the
commands, and [CHANGELOG.md](./CHANGELOG.md) for what has landed.

## Development

```bash
pnpm install
pnpm dev            # playground at http://localhost:5173
pnpm test           # unit tests (node)
pnpm test:browser   # component tests in real Chromium — never jsdom
pnpm test:visual    # Playwright screenshot comparison
pnpm test:coverage  # both suites, one coverage report
pnpm bench
pnpm verify         # lint, typecheck, all tests with coverage, build
```

Component tests run in a real browser on purpose: virtualization and synced
scrolling depend on layout and scrolling, which jsdom does not implement.
Reference screenshots are updated only in a deliberate commit
(`pnpm test:visual:update`).

Coverage is reported over both suites at once — half of Krona is exercised from
node and half from a browser, and either number alone is a lie about the other.
The thresholds are a floor set just under where the suite stands, there to catch
a feature landing untested, not a target to decorate.

The published packages ask for Node 18.18 or newer — they hold no Node-only code
and that floor is about the tooling that installs them. Working on Krona itself
needs 20.19, which is what its own toolchain requires.

Pushing a `v*` tag publishes both packages to npm with provenance and opens a
GitHub Release. [RELEASING.md](./RELEASING.md) has the steps and the one secret
the repository needs.

`pnpm check-docs` reads the public surface out of the source and fails when a
name stops being mentioned in a language's documents — the README and its
[reference page](./docs/reference.md) together — so a prop cannot land
undocumented in either language.

`pnpm check-names` fails on two files a case-insensitive filesystem cannot tell
apart. Linux CI is the one machine where such a pair is harmless, so it is the
one that has to look: `unified.ts` beside `Unified.tsx` built here and nowhere
else, because rolldown probes `.tsx` before `.ts` and macOS answers with the
component.

`pnpm build:social` regenerates `playground/public/social-preview.png` — the card
GitHub shows for the repository (upload it under Settings → Social preview) and
the one the demo hands to a chat client. The diff on it is a screenshot of the
real demo rather than a mock-up, so the card cannot promise a look the library
does not have.

## License

MIT
