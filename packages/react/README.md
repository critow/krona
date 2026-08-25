# krona

**Collapsible tree view and side-by-side diff for configuration files, as a React component.**

JSON/JSONC · YAML · TOML · INI/.env

[**Demo**](https://critow.github.io/krona/) · [**Full documentation**](https://github.com/critow/krona#readme) · [Русский](https://github.com/critow/krona/blob/main/README.ru.md)

![Side-by-side diff of two JSON files](https://raw.githubusercontent.com/critow/krona/main/docs/assets/diff-dark.png)

```bash
npm install krona
```

```tsx
import { Krona } from 'krona'

<Krona format="yaml" theme="dark">
  <Krona.Viewer source={text} defaultCollapsedDepth={2} />
</Krona>

<Krona format="json" theme="dark">
  <Krona.Diff left={before} right={after} collapseUnchanged />
</Krona>
```

- Folds like an editor; collapsed blocks read `{ 3 items }`.
- Diffs like git: line based, side by side, with word-level highlighting.
- Composable — each mode takes apart into the same public parts.
- Three runtime dependencies: `jsonc-parser`, `yaml`, `diff`.
- No `innerHTML`, no JavaScript objects built from your file, bidi and
  zero-width characters shown as visible badges.

YAML lives behind `krona/yaml` so its parser never reaches a bundle that only
shows JSON. The headless model and diff are published separately as
[`@krona/core`](https://www.npmjs.com/package/@krona/core).

The [full README](https://github.com/critow/krona#readme) covers every prop,
label, CSS variable and safety limit.

## License

MIT
