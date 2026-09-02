# Krona reference

Every prop, part, label, custom property and parse limit. The
[README](../README.md) is the tour; this is the index you come back to.

A CI check reads the public surface out of the source and fails when a name
here stops being mentioned, so a prop cannot land undocumented.

## Props reference

### `<Krona>`

The configuration root. It carries format, theme and labels in context and
paints nothing beyond a themed container; parsing and state live in the modes
below it.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `format` | `Format` | `'auto'` | Provider id, or `'auto'` to sniff among [registered providers](../README.md#formats) |
| `theme` | `'light' \| 'dark' \| 'auto'` | `'auto'` | `'auto'` follows `prefers-color-scheme` |
| `labels` | `Partial<KronaLabels>` | English defaults | Every visible string — see [Localization](#localization) |
| `locale` | `string` | runtime default | BCP 47 locale used by `Intl.NumberFormat` in the default labels |
| `lineHeight` | `number` | `20` | Row height in pixels; also sets `--krona-line-height`. Fixed height is what makes virtualization exact |
| `narrowWidth` | `number` | `640` | Below this width the modes lay out for a small screen — see [Small screens](../README.md#small-screens). Measured on the root, not the window; `0` disables |
| `limits` | `Partial<ParseLimits>` | see [Safety limits](#safety-limits) | Overrides for the parser's bounds |
| `providers` | `FormatRegistry` | module registry | Custom provider lookup |
| `injectStyles` | `boolean` | `true` | Adds the stylesheet to `document.head` on mount |
| `className` / `style` | — | — | Applied to the themed container |

### `<Krona.Viewer>`

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `source` | `string` | — | File contents. Provide this **or** `model` |
| `model` | `DocumentModel` | — | A model parsed elsewhere, e.g. [in a Worker](../README.md#large-files-and-web-workers). Wins over `source` |
| `format` | `Format` | from `<Krona>` | Overrides the enclosing format |
| `labels` | `Partial<KronaLabels>` | from `<Krona>` | Overrides the enclosing labels |
| `defaultCollapsedDepth` | `number` | — | Collapse every range at this nesting depth or deeper, on mount and whenever the value changes; `0` collapses everything |
| `overscan` | `number` | `8` | Extra rows rendered outside the viewport |
| `showDiagnostics` | `boolean` | `true` | Show parse errors above the document (default layout only) |
| `showSearch` | `boolean` | `false` | Show the search field above the document (default layout only) |
| `selectedLine` | `number` | — | Single one line out: open what hides it, scroll to it, mark it. Counted from 1, as the gutter counts, because this is the number a link carries |
| `onSelectLine` | `(line: number) => void` | — | Called with a line number, from 1, when the reader picks a line out. Adds the link action to the row |
| `editable` | `boolean` | `false` | Let the reader edit the document — see [Editing](../README.md#editing) |
| `onChange` | `(source: string) => void` | — | Called with the whole document after every edit, undo and redo |
| `className` / `style` | — | — | Applied to the viewer region |
| `children` | `ReactNode` | default layout | [Custom layout](../README.md#custom-layouts) from the same public parts |

### `<Krona.Diff>`

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `left` / `right` | `string` | — | The two versions. Provide these **or** the model props |
| `leftModel` / `rightModel` | `DocumentModel` | — | Pre-parsed models, e.g. [from a Worker](../README.md#large-files-and-web-workers) |
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
| `children` | `ReactNode` | two default panels | [Custom layout](../README.md#custom-layouts) |

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
| `Krona.SideSwitch` | diff only | Chooses the version a [narrow](../README.md#small-screens) diff shows. `always?: boolean`; renders nothing where both panels fit |
| `Krona.ExpandBar` | rendered for you | The hidden-rows bar; exported for restyling |

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
| `linkToLine` | `string` | `Link to this line` | Row action that picks the line out, shown when `onSelectLine` is given |
| `copied` | `string` | `Copied` | Shown briefly on a copy action that has run |
| `search` | `string` | `Search` | Search field placeholder and accessible name |
| `nextMatch` / `previousMatch` | `string` | `Next match` / `Previous match` | Search step buttons |
| `matchCase` | `string` | `Match case` | Search toggle for case-sensitive matching |
| `matchCount` | `(position: number, total: number, more: boolean) => string` | `3 / 17` | Match counter; `more` when the count is a floor |
| `noMatches` | `string` | `No matches` | Shown and announced when a query finds nothing |

The defaults themselves are exported, for a control of your own that has to
name the same things Krona does:

| Export | What it does |
| --- | --- |
| `createDefaultLabels(locale?)` | The full set of English defaults, with numbers formatted for `locale` |
| `resolveLabels(overrides?, locale?)` | The defaults with your overrides merged over them |

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
| Selected line | `--krona-row-selected` |
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

## Core API

Everything `@kronajs/core` exports. It has no React and no DOM, so it also runs
in a Worker, in Node, or behind a binding of your own — the React package is a
thin layer over this.

The README shows [the handful you reach for first](../README.md#using-the-core-without-react);
this is the whole list.

### Parsing and the model

| Export | What it does |
| --- | --- |
| `parseDocument(source, format?, options?)` | `DocumentModel` — never throws for content reasons |
| `toSnapshot` / `fromSnapshot` | Structured-clone-safe projection, for handing a model out of a Worker |
| `splitLines(source)` | Lines, accepting LF, CRLF and CR; a trailing newline adds no phantom line |
| `OffsetIndex` | Character offset to line number, for providers that work from a parser's offsets |
| `contentColumnsOf(...models)` | Width to reserve, in characters, so the horizontal extent does not shift while scrolling |
| `DEFAULT_LIMITS` | The parse budget: a hostile 200 MB file fails fast with a diagnostic instead of freezing the tab |

### Formats

| Export | What it does |
| --- | --- |
| `jsonProvider` | JSON and JSONC. Folding comes from a streaming visitor, so no object is ever built from the document |
| `tomlProvider` | TOML: `[table]` and `[[array of tables]]`, nested by dotted path |
| `iniProvider` | INI and dotenv. `[section]` headers fold; a flat `.env` has nothing to fold |
| `textProvider` | The fallback: every line plain, nothing folds. Used whenever a provider is missing, throws, or a limit is hit |
| `registerFormat(provider)` / `unregisterFormat(id)` | Add or remove a provider in the module-level registry |
| `getFormat(id)` / `listFormats()` | Look one up, or list what is registered |
| `defaultRegistry` | The module-level registry itself, for passing explicitly |
| `detectFormat(source, lines, registry?)` | Most likely format among *registered* providers; `'text'` when nothing is convincing |

### Folding

| Export | What it does |
| --- | --- |
| `collapsedToDepth(model, depth?)` | Start lines to fold for an opening depth |
| `allCollapsed(model)` | Start lines of every range — the document fully folded |
| `visibleLines(model, collapsed)` | Line indices still on screen, in order |
| `nestingLevelAt(model, line)` | How deep a line sits, 1 at the top |

### Paths

| Export | What it does |
| --- | --- |
| `pathSegmentOf(parts)` | The fragment one line contributes to a path |
| `joinPath(fragments)` | Those fragments joined into `server.tls.ciphers[0]` |

### Diff

| Export | What it does |
| --- | --- |
| `diffLines(left, right, options?)` | `DiffResult` — line runs, plus `approximate` when the budget ran out |
| `diffLineArrays(left, right, options?)` | The same for documents already split into lines |
| `alignDiff(result, options?)` | `AlignedDiff` — rows for two panels, with spacers, plus `stats` |
| `similarityOf(a, b)` | Cheap `0..1` likeness from shared prefix and suffix, telling a rewrite from a coincidence |
| `nextChangedRow(rows, from)` / `previousChangedRow(rows, from)` | The next or previous row that is not `equal` |
| `intralineDiff(left, right, options?)` | Word-level spans for one changed row |
| `tokenizeWords(text)` | The word split that word-level diffing runs on |
| `unifiedPatch(rows, leftLines, rightLines, options?)` | The diff as a unified patch — the text `diff -u` prints and `git apply` reads. The sides are lines, which is what `diffLines` already carries as `result.left` and `result.right` |

### Collapsing unchanged runs

| Export | What it does |
| --- | --- |
| `collapseUnchanged(rows, options?)` | Runs worth hiding behind a bar |
| `expandRegion(region, direction, step?)` | What stays hidden after expanding up, down or all — `null` once nothing does |
| `hiddenCount(region)` | How many rows a region hides |
| `hiddenRowSet(regions)` | Row-to-region lookup, so a renderer skips hidden rows in O(1) |

### What a diff shows

| Export | What it does |
| --- | --- |
| `buildRowIndex(rows, left, right)` | `RowIndex` — which row shows each line of either version |
| `hasFoldAt(row, rows, left, right)` | Whether either version opens a block on that row |
| `foldEndRow(row, rows, left, right, index)` | Last row a fold there covers, across both sides |
| `displayItems(rows, left, right, index, collapsed, regions)` | `DisplayItem[]` — the rows a diff shows once folding and collapsing are applied |
| `unifiedEntries(items, rows)` | `UnifiedEntry[]` — the same alignment read as one column |

### Painting a line

| Export | What it does |
| --- | --- |
| `buildSegments(text, tokens, intraline, whole, matches?, current?)` | `Segment[]` — the runs a line splits into once tokens, word-level highlights, search matches and unsafe characters are merged |
| `scanUnsafeCharacters(text)` | Bidi and invisible characters, with positions |
| `hasUnsafeCharacters(text)` | Whether the line holds any, allocation free |

### Search

| Export | What it does |
| --- | --- |
| `findMatches(model, query, options?)` | Literal matches, capped, with `truncated` when the cap was hit |
| `matchAfter(matches, line, column, direction?)` | The match jumped to from a position, wrapping at the ends |
| `indexByLine(matches)` | `MatchIndex` — matches grouped by the line they sit on |
| `hitsInRowOrder(rows, left, right)` | A diff's hits in the order they appear on screen |
| `hitFrom(hits, position, direction)` | Index of the first hit past a position, wrapping at the ends |

### Editing

Editing is editing text: an edit produces a new source string, which is parsed
into a new model. Nothing mutates in place.

| Export | What it does |
| --- | --- |
| `applyEdit(source, edit)` | `EditResult` — the new source and the edit that undoes it |
| `minimalEdit(before, after)` | The smallest single edit between two strings, so an edit and its formatting undo as one |
| `formattedEdit(model, edit, expand, registry?)` | The edit with the format's own formatting applied to what it inserts |
| `lineSpanAt(model, line)` | The line's text as a span of the source, without its terminator |
| `blockSpanAt(model, line)` | The whole block opening on that line, or just the line |
| `valueSpansAt(model, line)` | Every value on the line, left to right |
| `offsetOfLine(model, line)` | Source offset where the line begins |
| `removeBlockEdit(model, line)` | An edit removing that block or line, terminator and dangling separator included |
| `duplicateBlockEdit(model, line)` | An edit copying it, with where the copy lands |
| `emptyHistory(source)` | `EditHistory` — text with nothing to undo yet |
| `withEdit(history, edit)` | The history after one more edit; ends the redo branch |
| `withUndo(history)` / `withRedo(history)` | One step back or forward, or the same history when there is nowhere to go |
