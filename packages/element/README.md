# @kronajs/element

**A configuration file as a collapsible, virtualized tree — as a custom
element.** The same engine as [`kronajs`](https://www.npmjs.com/package/kronajs)
without the React: usable from Vue, Svelte, Angular, Astro, or an HTML file with
a script tag.

[**Demo**](https://critow.github.io/krona/) · [**Full documentation**](https://github.com/critow/krona#readme)

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

The document is a **property, not an attribute**: a file is not something a page
wants to put in its markup. (`source` works as an attribute too, for short
documents.)

## Attributes

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

## Properties, methods and events

| Member | What it is |
| --- | --- |
| `source` | The file to show |
| `model` | The parsed document, once there is one |
| `labels` | Overrides for the built-in English strings |
| `expandAll()` / `collapseAll()` | Open or close every folding range |
| `revealLine(line)` | Open whatever hides a line and scroll to it, counting from 1 |
| `krona-fold` | Fired when a block is folded or unfolded: `{ line, folded }` |

Styles travel with the element — it puts the stylesheet in its own shadow root,
so nothing on the page can reach in and nothing leaks out. Theming is the same
`--krona-*` custom properties as the React package, and custom properties do
cross a shadow boundary, so setting them on any ancestor still works.

## What it does not do

Diffing, searching, editing, row actions and the minimap are `kronajs` only for
now. If you need those and can run React, use that package; the model, folding
and diff underneath both live in
[`@kronajs/core`](https://www.npmjs.com/package/@kronajs/core).

Formats: JSON/JSONC, TOML and INI/.env register from the main entry point; YAML
lives behind `@kronajs/element/yaml` because its parser is tens of kilobytes.

## License

MIT
