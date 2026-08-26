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
