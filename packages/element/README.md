# @kronajs/element

**Config files as a folding tree and a side-by-side diff — as custom elements.**
The same engine as [`kronajs`](https://www.npmjs.com/package/kronajs) without the
React: usable from Vue, Svelte, Angular, Astro, or an HTML file with a script
tag.

[**Live, on a page with no framework on it**](https://critow.github.io/krona/element.html) · [**Full documentation**](https://github.com/critow/krona#readme)

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

Documents are **properties, not attributes**: a file is not something a page
wants to put in its markup. (`source`, `left` and `right` work as attributes too,
for short documents.)

## `<krona-viewer>`

| Attribute | Default | What it does |
| --- | --- | --- |
| `format` | `auto` | `json`, `yaml`, `toml`, `ini`, or `auto` to sniff |
| `theme` | `auto` | `light`, `dark`, or `auto` to follow `prefers-color-scheme` |
| `locale` | runtime default | BCP 47 locale used to format numbers in the default strings |
| `line-height` | `20` | Row height in pixels; virtualization needs it fixed |
| `collapsed-depth` | — | Fold every range at this nesting depth or deeper on load |
| `overscan` | `8` | Extra rows rendered outside the viewport |
| `selected-line` | — | Single a line out and scroll to it, counting from 1 |
| `show-diagnostics` | `true` | Set `false` to hide parse problems |
| `show-search` | `false` | Set `true` for a field that finds text in what is on screen |
| `show-actions` | `true` | Set `false` to take the copy actions off the rows |
| `link-lines` | off | Present to offer a link action on every row, reported as `krona-select-line` |

| Member | What it is |
| --- | --- |
| `source` | The file to show |
| `model` | The parsed document, once there is one |
| `labels` | Overrides for the built-in English strings |
| `expandAll()` / `collapseAll()` | Open or close every folding range |
| `revealLine(line)` | Open whatever hides a line and scroll to it, counting from 1 |

## `<krona-diff>`

```html
<krona-diff id="changes" format="json" collapse-unchanged></krona-diff>

<script type="module">
  const diff = document.getElementById('changes')
  diff.left = before
  diff.right = after
</script>
```

Both panels render one shared row list at one fixed row height, so folding a
block hides it on **both** sides and the two scroll in exact lockstep rather
than by a ratio.

| Attribute | Default | What it does |
| --- | --- | --- |
| `format`, `theme`, `locale`, `line-height`, `overscan`, `collapsed-depth`, `show-diagnostics` | | As above |
| `collapse-unchanged` | off | Hide long unchanged runs behind an expand bar |
| `context` / `minimum-hidden` / `step` | `3` / `10` / `20` | Rows kept around a change, the shortest run worth hiding, and how much one click reveals |
| `ignore-trailing-whitespace` | off | Treat lines differing only in trailing space as equal |
| `show-toolbar` | `true` | The fold actions and the change counts |
| `show-markers` | `true` | `+` / `-` / `~` in the gutter |
| `show-search` | `false` | A field that finds text in both versions |
| `show-actions` | `true` | Set `false` to take the copy actions off the rows |
| `link-lines` | off | Present to offer a link action on every row |
| `show-minimap` | `false` | A strip between the panels marking where the changes are |
| `view` | `auto` | `split` for two panels, `unified` for one column, `auto` to split where there is room |
| `narrow-width` | `640` | Width below which `auto` unifies. `0` keeps two panels always |

| Member | What it is |
| --- | --- |
| `left` / `right` | The two versions |
| `aligned` | The alignment and its statistics, once there is a diff |
| `labels` | Overrides for the built-in English strings |
| `expandAll()` / `collapseAll()` | Open or close every folding range and hidden run |
| `showSide('left' \| 'right')` | Which version a narrow layout shows |

Below `narrow-width` a diff turns **unified**: one column, the old line above
the new one. Two panels on a phone are about ten characters each, which shows
neither version, and one column needs only the width of a single line. `view`
overrides that either way; a narrow diff kept `split` shows one version at a
time, with a switch between them.

The width watched is the element's own, not the window's: a diff in a sidebar on
a wide screen is just as cramped as one on a phone, and a media query cannot
tell the difference.

## Search

`show-search="true"` puts a field above the document. Matching is literal, never
a pattern: a regular expression typed into a text field is one a stranger can
type too, and a viewer that stops answering is a worse outcome than one that
cannot match `\d+`. Enter walks the matches, Shift+Enter walks them backwards,
and `Aa` makes the query case-sensitive.

In a diff the matches are ordered by row rather than by document, so walking
them reads down the screen: a line removed and the line that replaced it are
neighbours, however far apart they sit in their own files. Reaching one opens
whatever hides it — a folded block, a collapsed run of unchanged rows, or both.

## Row actions

Hovering a row offers what is worth taking from it: the value on the line, the
dotted path to it, and the whole block where the line opens one. With
`link-lines`, a link action too.

A copy that the browser refused says nothing rather than claiming success — the
Clipboard API needs a secure context and a permission, and refuses outright in
some embeddings.

## Events

| Event | Detail | When |
| --- | --- | --- |
| `krona-fold` | `{ line, folded }` | A block is folded or unfolded |
| `krona-select-line` | `{ line, side? }` | A reader picks a line out, where `link-lines` is set. `side` names the version in a diff |

Lines count from 1. Both events bubble and cross the shadow boundary, so a
listener on any ancestor sees them.

## Keyboard

A document is a tree, and a tree is walked with the arrows: Tab enters it once
and leaves it once. ↑ / ↓ move by row, Home / End jump to the ends, → opens a
folded block and then steps into it, ← closes an open one and then walks out to
its parent, and Enter or Space toggles the block on the current row.

## Styles

The stylesheet travels inside each element's own shadow root, so nothing on the
page can reach in and nothing leaks out. Theming is the same `--krona-*` custom
properties as the React package, and custom properties *do* cross a shadow
boundary, so setting them on any ancestor still works:

```css
krona-viewer {
  --krona-height: 30rem;
  --krona-font-size: 13px;
}
```

`@kronajs/element/styles.css` ships the same bytes for a page that would rather
own one stylesheet, though nothing needs it.

## In each framework

**Vue** — tell the compiler the tags are not components, or it warns about every
one of them:

```js
// vite.config.js
vue({ template: { compilerOptions: { isCustomElement: (tag) => tag.startsWith('krona-') } } })
```

Then bind documents with `.prop`, since they are properties:
`<krona-viewer :source.prop="text" format="yaml" />`.

**Svelte** — nothing to configure; `<krona-viewer source={text} />` sets the
property when one exists, which it does.

**Angular** — add `CUSTOM_ELEMENTS_SCHEMA` to the module or component, then
`<krona-viewer [source]="text">`.

**React 19** — works as written: `<krona-viewer source={text} />`. On React 18
and earlier, set the property through a ref instead, or just use `kronajs`.

**Astro, Rails, Django, a plain page** — a script tag and the markup above.

Call `defineKrona()` once, after the page has loaded the module. Registering a
name twice throws, so calling it again is a no-op rather than an error; there is
also `defineKronaViewer(name?)` and `defineKronaDiff(name?)` if you would rather
register one, or register under a name of your own.

## What it does not do

Editing is `kronajs` only for now. If you need those and can run React, use that
package; the model, folding and diff underneath both live in
[`@kronajs/core`](https://www.npmjs.com/package/@kronajs/core).

Formats: JSON/JSONC, TOML and INI/.env register from the main entry point; YAML
lives behind `@kronajs/element/yaml` because its parser is tens of kilobytes.

## License

MIT
