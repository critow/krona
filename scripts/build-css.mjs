// The stylesheet is authored as plain CSS (editor tooling, no escaping) and
// mirrored into a TypeScript constant so it can also be injected at runtime for
// zero-config usage. Run with --check to fail when the two drift apart.
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const cssPath = fileURLToPath(new URL('../packages/react/src/theme/krona.css', import.meta.url))
const tsPath = fileURLToPath(new URL('../packages/react/src/theme/css.ts', import.meta.url))

const css = readFileSync(cssPath, 'utf8')
if (css.includes('`') || css.includes('${')) {
  console.error(
    'krona.css must not contain a backtick or ${ — it is embedded in a template literal.',
  )
  process.exit(1)
}

const banner = [
  '/**',
  ' * GENERATED FILE — edit src/theme/krona.css and run `pnpm build:css`.',
  ' *',
  " * Krona's stylesheet is mirrored here so it can be injected at runtime for",
  ' * zero-config usage, while `kronajs/styles.css` ships the same bytes for',
  ' * consumers who own their CSS pipeline.',
  ' *',
  ' * Everything is driven by `--krona-*` custom properties: override them on any',
  ' * ancestor to theme the viewer without touching a selector.',
  ' */',
  'export const KRONA_CSS = `',
].join('\n')

const generated = `${banner}${css}\`\n`
let current = ''
try {
  current = readFileSync(tsPath, 'utf8')
} catch {
  current = ''
}

if (process.argv.includes('--check')) {
  if (current !== generated) {
    console.error('packages/react/src/theme/css.ts is stale. Run `pnpm build:css`.')
    process.exit(1)
  }
  console.log('css.ts is up to date')
} else if (current !== generated) {
  writeFileSync(tsPath, generated)
  console.log('wrote packages/react/src/theme/css.ts')
} else {
  console.log('css.ts is up to date')
}
