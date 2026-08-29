# @kronajs/core

**Framework-agnostic document model, format providers and line diff for
configuration files.** The engine behind [`kronajs`](https://www.npmjs.com/package/kronajs);
no React, no DOM.

[**Demo**](https://critow.github.io/krona/) · [**Full documentation**](https://github.com/critow/krona#readme)

```bash
npm install @kronajs/core
```

```ts
import { parseDocument, diffLines, alignDiff } from '@kronajs/core'
import '@kronajs/core/yaml'

const doc = parseDocument(source, 'yaml')
doc.lines            // source lines
doc.foldingRanges    // collapsible ranges
doc.tokensAt(12)     // tokens for one line, computed on demand and memoized
doc.diagnostics      // parse problems, never thrown

const { rows, stats } = alignDiff(diffLines(before, after))
```

The model is **lines plus folding ranges**, not a tree of values: diffing is
line based and folding is range based, so one representation serves both — and
no JavaScript object is ever built from the document, which rules out prototype
pollution through a `__proto__` key by construction.

| Function | Returns |
| --- | --- |
| `parseDocument(source, format?, options?)` | `DocumentModel` — never throws for content reasons |
| `diffLines(left, right, options?)` | `DiffResult`, with `approximate` when the time budget ran out |
| `alignDiff(result, options?)` | Rows for two panels, with spacers, plus `stats` |
| `intralineDiff(left, right, options?)` | Word-level spans for one changed row |
| `collapseUnchanged(rows, options?)` | Unchanged runs worth hiding |
| `scanUnsafeCharacters(text)` | Bidi and invisible characters, with positions |
| `toSnapshot` / `fromSnapshot` | Structured-clone-safe projection, for Web Workers |

Formats: JSON/JSONC, TOML and INI/.env register from the main entry point; YAML
lives behind `@kronajs/core/yaml` because its parser is tens of kilobytes.

## License

MIT
