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
[![Types: included](https://img.shields.io/badge/types-included-5ccfe6?style=flat-square)](#props-reference)
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
  the build if a sixth appears. `@krona/core` is ours; React is a peer.
- **Safe with untrusted content.** No `innerHTML` anywhere, no JavaScript objects built from your file, bidi and zero-width characters rendered as visible badges.

![Side-by-side diff of two JSON files](./docs/assets/diff-dark.png)

## Contents

- [Installation](#installation)
- [Quick start](#quick-start)
- [Formats](#formats)
- [Props reference](#props-reference)
  - [`<Krona>`](#krona)
  - [`<Krona.Viewer>`](#kronaviewer)
  - [`<Krona.Diff>`](#kronadiff)
  - [Parts](#parts)
- [Editing](#editing)
- [Custom layouts](#custom-layouts)
- [Hooks](#hooks)
- [Localization](#localization)
- [Small screens](#small-screens)
- [Theming](#theming)
- [Safety limits](#safety-limits)
- [Large files and Web Workers](#large-files-and-web-workers)
- [Using the core without React](#using-the-core-without-react)
- [Design notes](#design-notes)
- [Roadmap](#roadmap)
- [Development](#development)
- [License](#license)

## Installation

```bash
npm install krona
```

React 18 or 19 is a peer dependency.

## Quick start

```tsx
import { Krona } from 'krona'

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
pipeline, pass `injectStyles={false}` and `import 'krona/styles.css'` yourself.

![Viewer showing a YAML file with folded blocks](./docs/assets/viewer-dark.png)

## Formats

Importing `krona` registers **JSON/JSONC**, **TOML** and **INI/.env**. YAML sits
behind its own entry point, because the `yaml` parser is tens of kilobytes and
should not land in a bundle that only ever shows JSON:

```tsx
import 'krona/yaml'
```

`format="auto"` sniffs the content, but only among providers you actually
imported — it will never resurrect one you chose to leave out. An unknown
format, a malformed file or an oversized input degrades to plain text with a
diagnostic instead of throwing.

| Format | Entry point | What folds |
| --- | --- | --- |
| JSON / JSONC | `krona` | Objects and arrays; comments and trailing commas allowed |
| YAML | `krona/yaml` | Indentation, block scalars (`\|`, `>`), multi-line flow collections |
| TOML | `krona` | `[table]` and `[[array of tables]]`, nested by dotted path; multi-line strings and arrays |
| INI | `krona` | `[section]`, nested by dotted name |
| .env | `krona` | Nothing — a flat file has nothing to fold, only highlighting |

## Props reference

### `<Krona>`

The configuration root. It carries format, theme and labels in context and
paints nothing beyond a themed container; parsing and state live in the modes
below it.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `format` | `Format` | `'auto'` | Provider id, or `'auto'` to sniff among [registered providers](#formats) |
| `theme` | `'light' \| 'dark' \| 'auto'` | `'auto'` | `'auto'` follows `prefers-color-scheme` |
| `labels` | `Partial<KronaLabels>` | English defaults | Every visible string — see [Localization](#localization) |
| `locale` | `string` | runtime default | BCP 47 locale used by `Intl.NumberFormat` in the default labels |
| `lineHeight` | `number` | `20` | Row height in pixels; also sets `--krona-line-height`. Fixed height is what makes virtualization exact |
| `narrowWidth` | `number` | `640` | Below this width the modes lay out for a small screen — see [Small screens](#small-screens). Measured on the root, not the window; `0` disables |
| `limits` | `Partial<ParseLimits>` | see [Safety limits](#safety-limits) | Overrides for the parser's bounds |
| `providers` | `FormatRegistry` | module registry | Custom provider lookup |
| `injectStyles` | `boolean` | `true` | Adds the stylesheet to `document.head` on mount |
| `className` / `style` | — | — | Applied to the themed container |

### `<Krona.Viewer>`

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `source` | `string` | — | File contents. Provide this **or** `model` |
| `model` | `DocumentModel` | — | A model parsed elsewhere, e.g. [in a Worker](#large-files-and-web-workers). Wins over `source` |
| `format` | `Format` | from `<Krona>` | Overrides the enclosing format |
| `labels` | `Partial<KronaLabels>` | from `<Krona>` | Overrides the enclosing labels |
| `defaultCollapsedDepth` | `number` | — | Collapse every range at this nesting depth or deeper, on mount and whenever the value changes; `0` collapses everything |
| `overscan` | `number` | `8` | Extra rows rendered outside the viewport |
| `showDiagnostics` | `boolean` | `true` | Show parse errors above the document (default layout only) |
| `showSearch` | `boolean` | `false` | Show the search field above the document (default layout only) |
| `editable` | `boolean` | `false` | Let the reader edit the document — see [Editing](#editing) |
| `onChange` | `(source: string) => void` | — | Called with the whole document after every edit, undo and redo |
| `className` / `style` | — | — | Applied to the viewer region |
| `children` | `ReactNode` | default layout | [Custom layout](#custom-layouts) from the same public parts |

### `<Krona.Diff>`

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `left` / `right` | `string` | — | The two versions. Provide these **or** the model props |
| `leftModel` / `rightModel` | `DocumentModel` | — | Pre-parsed models, e.g. [from a Worker](#large-files-and-web-workers) |
| `format` | `Format` | from `<Krona>` | Overrides the enclosing format |
| `labels` | `Partial<KronaLabels>` | from `<Krona>` | Overrides the enclosing labels |
| `collapseUnchanged` | `boolean \| CollapseUnchangedOptions` | `false` | Hide long unchanged runs behind an expandable bar |
| `defaultCollapsedDepth` | `number` | — | Collapse folding ranges at this depth or deeper on load |
| `ignoreTrailingWhitespace` | `boolean` | `false` | Compare lines ignoring trailing whitespace |
| `view` | `'split' \| 'unified' \| 'auto'` | `'auto'` | Two panels, one column, or two until the root is narrower than `narrowWidth` |
| `showMinimap` | `boolean` | `false` | Show the change minimap between the panels (split view) |
| `showSearch` | `boolean` | `false` | Show the search field above the panels |
| `overscan` | `number` | `8` | Extra rows rendered outside the viewport |
| `className` / `style` | — | — | Applied to the diff region |
| `children` | `ReactNode` | two default panels | [Custom layout](#custom-layouts) |

`CollapseUnchangedOptions`:

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `context` | `number` | `3` | Unchanged rows kept visible on each side of a change |
| `minimumHidden` | `number` | `10` | Shortest run worth hiding; below it the bar costs more space than it saves |
| `step` | `number` | `20` | Rows revealed by one click of the up / down controls |

A row that opens a folding range is never hidden by this collapse — the run is
split around it, so its chevron stays reachable.

### Parts

Every part accepts `className` and `style`. `Gutter`, `Lines` and `Toolbar` are
the *same components* in both modes: they read the nearest line source and never
learn which mode they are in.

| Part | Where it belongs | Notes |
| --- | --- | --- |
| `Krona.Gutter` | viewer or panel | Line numbers, diff markers, fold chevrons. `showMarkers?: boolean` |
| `Krona.Lines` | viewer or panel | The document text, highlights and collapsed placeholders. `showCopyActions?: boolean` |
| `Krona.Toolbar` | above the content | Fold actions, plus change counts inside a diff. Accepts `children` |
| `Krona.Diagnostics` | above the content | Parse problems. `includeWarnings?: boolean` |
| `Krona.Panel` | diff only | One side. `side: 'left' \| 'right'` |
| `Krona.Unified` | diff only | Both versions in one column, old line above new; what `view="unified"` renders |
| `Krona.Minimap` | diff only | Change map between the panels; throws elsewhere |
| `Krona.Search` | above the content | Search field, counter and step buttons. `showMatchCase?: boolean`, `autoFocus?: boolean` |
| `Krona.SideSwitch` | diff only | Chooses the version a [narrow](#small-screens) diff shows. `always?: boolean`; renders nothing where both panels fit |
| `Krona.ExpandBar` | rendered for you | The hidden-rows bar; exported for restyling |

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

## Localization

Krona ships **no i18n runtime**. Every visible string is an English default you
replace through `labels`, so plural rules and translation loading stay in your
app where they belong. Numbers in the defaults are formatted with
`Intl.NumberFormat` using `locale`.

| Label | Signature | Default | Where it appears |
| --- | --- | --- | --- |
| `expandAll` / `collapseAll` | `string` | `Expand all` / `Collapse all` | Toolbar |
| `expandBlock` / `collapseBlock` | `string` | `Expand block` / `Collapse block` | Gutter chevron, accessible name |
| `foldedItems` | `(count: number) => string` | `6 items` | Collapsed placeholder, when the item count is known |
| `foldedLines` | `(count: number) => string` | `12 lines` | Collapsed placeholder for block scalars |
| `hiddenLines` | `(count: number) => string` | `12 unchanged lines` | Expand bar in a diff |
| `expandUp` / `expandDown` / `expandAllHidden` | `string` | `Expand up` / … | Expand bar controls |
| `added` / `removed` / `changed` / `unchanged` | `string` | `Added` / … | Toolbar statistics |
| `leftPanel` / `rightPanel` | `string` | `Previous version` / `Current version` | Panel accessible names |
| `changeMap` | `string` | `Change map` | Minimap accessible name |
| `unsafeCharacter` | `(code: string) => string` | `Hidden character U+202E` | Tooltip on a dangerous-character badge |
| `document` | `string` | `Configuration file` | Region accessible name |
| `editValue` | `string` | `Edit value` | Tooltip on an editable value |
| `editLine` | `string` | `Edit line` | Row action opening the line as raw text |
| `editBlock` | `string` | `Edit block` | Row action opening the block as raw text |
| `deleteEntry` | `string` | `Delete` | Row action removing the entry |
| `saveEdit` | `string` | `Save` | Applies the open editor |
| `cancelEdit` | `string` | `Cancel` | Discards the open editor |
| `undo` | `string` | `Undo` | Toolbar action reversing the last edit |
| `redo` | `string` | `Redo` | Toolbar action replaying the last undone edit |
| `duplicateEntry` | `string` | `Duplicate` | Row action repeating the entry below itself |
| `copyEntry` | `string` | `Copy` | Row action copying the entry or block |
| `copyValue` | `string` | `Copy value` | Row action copying just the value |
| `copyPath` | `string` | `Copy path` | Row action copying the dotted path to the line |
| `copied` | `string` | `Copied` | Shown briefly on a copy action that has run |
| `search` | `string` | `Search` | Search field placeholder and accessible name |
| `nextMatch` / `previousMatch` | `string` | `Next match` / `Previous match` | Search step buttons |
| `matchCase` | `string` | `Match case` | Search toggle for case-sensitive matching |
| `matchCount` | `(position: number, total: number, more: boolean) => string` | `3 / 17` | Match counter; `more` when the count is a floor |
| `noMatches` | `string` | `No matches` | Shown and announced when a query finds nothing |

Russian needs three plural forms, which is exactly why plurals live in your app
and not in the library:

```tsx
function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few
  return many
}

<Krona
  locale="ru"
  labels={{
    collapseAll: 'Свернуть всё',
    expandAll: 'Развернуть всё',
    foldedItems: (n) => `${n} ${plural(n, 'элемент', 'элемента', 'элементов')}`,
  }}
>
  <Krona.Viewer source={text} />
</Krona>
```

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

## Theming

Everything is driven by `--krona-*` custom properties. Override them on any
ancestor — no selector needs to be touched.

```css
.my-viewer {
  --krona-height: 40rem;
  --krona-line-height: 22px;
  --krona-font-family: 'JetBrains Mono', monospace;
  --krona-token-key: #b45309;
}
```

| Group | Variables |
| --- | --- |
| Layout | `--krona-height`, `--krona-line-height`, `--krona-font-family`, `--krona-font-size`, `--krona-gutter-width`, `--krona-padding-inline` |
| Surfaces | `--krona-bg`, `--krona-bg-gutter`, `--krona-bg-hover`, `--krona-border`, `--krona-fg`, `--krona-fg-muted` |
| Controls | `--krona-chevron`, `--krona-chevron-hover`, `--krona-scrollbar` |
| Search | `--krona-match-bg`, `--krona-match-current-bg` |
| Tokens | `--krona-token-key`, `-string`, `-number`, `-boolean`, `-null`, `-comment`, `-punctuation`, `-section` |
| Diff | `--krona-added-bg`, `--krona-added-strong-bg`, `--krona-removed-bg`, `--krona-removed-strong-bg`, `--krona-spacer-bg`, `--krona-added-marker`, `--krona-removed-marker` |
| Warnings | `--krona-unsafe-bg`, `--krona-unsafe-fg` |
| Tooltips | `--krona-tooltip-bg`, `--krona-tooltip-fg` |

`theme="light" \| "dark" \| "auto"`; `auto` follows `prefers-color-scheme`.

![The same diff in the light theme, with unchanged runs folded away](./docs/assets/diff-light.png)

## Safety limits

File contents are untrusted input. Every bound below has a default, is
configurable through `limits`, and degrades with a readable diagnostic rather
than a frozen tab.

| Limit | Default | What happens past it |
| --- | --- | --- |
| `maxInputLength` | 10 MiB | Plain text, no folding or highlighting, error diagnostic |
| `maxDepth` | 64 | Deeper folding ranges are dropped, warning diagnostic |
| `maxFoldRanges` | 200 000 | Folding stops, warning diagnostic |
| `maxTokenizedLineLength` | 10 000 | That line renders unstyled |
| `maxValidatedLength` | 64 KiB | YAML skips its validation pass; folding and highlighting are unaffected |

The diff has its own budget: Myers is O(ND), so a `timeout` (1500 ms by default)
falls back to a common prefix/suffix approximation, the same trade git makes
when its heuristics give up.

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
import { parseDocument, toSnapshot } from '@krona/core'
import '@krona/core/yaml'

self.onmessage = ({ data }) => {
  const model = parseDocument(data.source, data.format)
  self.postMessage(toSnapshot(model))
}
```

```tsx
// app.tsx
import { fromSnapshot } from '@krona/core'

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

## Using the core without React

```ts
import { parseDocument, diffLines, alignDiff, intralineDiff } from '@krona/core'
import '@krona/core/yaml'

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

Krona 0.1 shows one configuration file, or two of them — side by side or in one
column — lets you [edit](#editing) the single file and [search](#search) either.
Everything below is deliberately absent rather than forgotten.

| Not in 0.1 | Reasoning | Likely |
| --- | --- | --- |
| More formats (XML, `.properties`, HCL) | Each is a provider — an `analyze` and a `tokenize` — behind the same interface. Waiting for someone to actually need one. | Maybe |
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
pnpm bench
pnpm verify         # lint, typecheck, all tests, build
```

Component tests run in a real browser on purpose: virtualization and synced
scrolling depend on layout and scrolling, which jsdom does not implement.
Reference screenshots are updated only in a deliberate commit
(`pnpm test:visual:update`).

The published packages ask for Node 18.18 or newer — they hold no Node-only code
and that floor is about the tooling that installs them. Working on Krona itself
needs 20.19, which is what its own toolchain requires.

Pushing a `v*` tag publishes both packages to npm with provenance and opens a
GitHub Release. [RELEASING.md](./RELEASING.md) has the steps and the one secret
the repository needs.

`pnpm build:social` regenerates `playground/public/social-preview.png` — the card
GitHub shows for the repository (upload it under Settings → Social preview) and
the one the demo hands to a chat client. The diff on it is a screenshot of the
real demo rather than a mock-up, so the card cannot promise a look the library
does not have.

## License

MIT
