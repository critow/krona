# Krona

[English](./README.md) · [Русский](./README.ru.md)

Collapsible tree view and side-by-side diff for configuration files, as a React
component. JSON/JSONC, YAML, TOML and INI/.env.

- **Fold like an editor.** Objects, arrays, YAML blocks, TOML tables and INI
  sections collapse from the gutter, with a placeholder showing what is hidden.
- **Diff like git.** Line-based, side by side, with word-level highlighting
  inside changed lines and long unchanged runs folded behind an expand bar.
- **Composable.** Each mode renders a default layout, or takes apart into the
  same public parts when you want your own.
- **Three runtime dependencies.** `jsonc-parser`, `yaml` and `diff` — nothing else.

```bash
npm install krona
```

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

## Formats

Importing `krona` registers **JSON/JSONC**, **TOML** and **INI/.env**. YAML sits
behind its own entry point, because the `yaml` parser is tens of kilobytes and
should not land in a bundle that only ever shows JSON:

```tsx
import 'krona/yaml'
```

`format="auto"` sniffs the content, but only among providers you actually
imported — it will never resurrect one you chose to leave out. An unknown format,
a malformed file or an oversized input degrades to plain text with a diagnostic
instead of throwing.

| Format | Folding |
| --- | --- |
| JSON / JSONC | objects and arrays; comments and trailing commas allowed |
| YAML | indentation, block scalars (`\|`, `>`), multi-line flow collections |
| TOML | `[table]` and `[[array of tables]]`, nested by dotted path; multi-line strings and arrays |
| INI | `[section]`, nested by dotted name |
| .env | none — a flat file has nothing to fold |

## Custom layouts

`Krona.Viewer` and `Krona.Diff` render a default layout when given no children.
Supply children and you compose the same public parts yourself; arbitrary JSX may
sit between them.

```tsx
<Krona format="json">
  <Krona.Diff left={before} right={after}>
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

`Krona.Gutter` and `Krona.Lines` are the *same components* in both modes. They
read the nearest line source — provided by the viewer, or by each panel of a
diff — so they never learn which mode they are in. Parts declare where they
belong, which is why they can be written as plain siblings and still end up
inside the scroll container they need.

## Hooks

```tsx
const { model, foldState, toggleFold, expandAll, collapseAll } = useKronaViewer()
const { alignedRows, stats, expandContext, toggleRowFold } = useKronaDiff()
```

Both throw a clear error outside their mode.

## Localization

Krona ships **no i18n runtime**. Every visible string is an English default you
replace through `labels`, so plural rules and translation loading stay in your
app where they belong. Numbers in the defaults are formatted with
`Intl.NumberFormat` using `locale`.

```tsx
function lines(count: number): string {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod10 === 1 && mod100 !== 11) return 'строка'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'строки'
  return 'строк'
}

<Krona
  locale="ru"
  labels={{
    collapseAll: 'Свернуть всё',
    expandAll: 'Развернуть всё',
    foldedLines: (n) => `${n} ${lines(n)}`,
  }}
>
  <Krona.Viewer source={text} />
</Krona>
```

## Theming

Everything is driven by `--krona-*` custom properties. Override them on any
ancestor:

```css
.my-viewer {
  --krona-height: 40rem;
  --krona-line-height: 22px;
  --krona-token-key: #b45309;
}
```

`theme="light" | "dark" | "auto"`; `auto` follows `prefers-color-scheme`.

## Using the core without React

```ts
import { parseDocument, diffLines, alignDiff, intralineDiff } from '@krona/core'
import '@krona/core/yaml'

const doc = parseDocument(source, 'yaml')
doc.lines            // source lines
doc.foldingRanges    // collapsible ranges
doc.tokensAt(12)     // tokens for one line, computed on demand and memoized

const { rows, stats } = alignDiff(diffLines(before, after))
```

## Large files

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

## Design notes

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

**No `innerHTML`, anywhere.** Content is emitted as React text nodes; the rule is
enforced by the linter.

**Aliases are never expanded.** A YAML "billion laughs" file costs no more than
its own size.

**Everything has a limit.** Input size, folding depth, folding count, line length
and diff time are all bounded, with a readable diagnostic and a graceful
downgrade rather than a frozen tab.

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

## License

MIT
