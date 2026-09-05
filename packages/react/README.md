# kronajs

**Collapsible tree view and side-by-side diff for configuration files, as a React component.**

JSON/JSONC · YAML · TOML · INI/.env

[**Demo**](https://critow.github.io/krona/) · [**Full documentation**](https://github.com/critow/krona#readme) · [Русский](https://github.com/critow/krona/blob/main/README.ru.md)

![Side-by-side diff of two JSON files](https://raw.githubusercontent.com/critow/krona/main/docs/assets/diff-dark.png)

```bash
npm install kronajs
```

```tsx
import { Krona } from 'kronajs'

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
- Five packages in the install tree: `jsonc-parser`, `yaml` and `diff` parse and
  diff; `@tanstack/react-virtual` and its `@tanstack/virtual-core` virtualize. A
  CI check fails the build if a sixth appears.
- No `innerHTML`, no JavaScript objects built from your file, bidi and
  zero-width characters shown as visible badges.

YAML lives behind `kronajs/yaml` so its parser never reaches a bundle that only
shows JSON; JSON5, XML, HCL and Java properties live behind `kronajs/json5`,
`kronajs/xml`, `kronajs/hcl` and `kronajs/properties` for the same reason. The headless model and diff are published separately as
[`@kronajs/core`](https://www.npmjs.com/package/@kronajs/core).

The [full README](https://github.com/critow/krona#readme) covers every prop,
label, CSS variable and safety limit.

## License

MIT
