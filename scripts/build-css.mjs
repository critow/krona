// The stylesheet is authored as plain CSS (editor tooling, no escaping) and
// mirrored into a TypeScript constant so it can also be injected at runtime for
// zero-config usage. Run with --check to fail when the two drift apart.
//
// It lives at the repository root rather than inside one package because more
// than one adapter renders these class names: whichever of them owned the file
// would be lending it to the others.
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const cssPath = fileURLToPath(new URL('../styles/krona.css', import.meta.url))
// Every package that renders these class names keeps a mirror of them.
const mirrors = ['packages/react/src/theme/css.ts', 'packages/element/src/theme/css.ts'].map(
  (path) => fileURLToPath(new URL(`../${path}`, import.meta.url)),
)

const css = readFileSync(cssPath, 'utf8')
if (css.includes('`') || css.includes('${')) {
  console.error(
    'krona.css must not contain a backtick or ${ — it is embedded in a template literal.',
  )
  process.exit(1)
}

const banner = [
  '/**',
  ' * GENERATED FILE — edit styles/krona.css and run `pnpm build:css`.',
  ' *',
  " * Krona's stylesheet is mirrored here so it can be injected at runtime for",
  ' * zero-config usage; every package that ships it also ships the same bytes',
  ' * as a `styles.css` for consumers who own their CSS pipeline.',
  ' *',
  ' * Everything is driven by `--krona-*` custom properties: override them on any',
  ' * ancestor to theme the viewer without touching a selector.',
  ' */',
  'export const KRONA_CSS = `',
].join('\n')

const generated = `${banner}${css}\`\n`
const check = process.argv.includes('--check')
let stale = false

for (const path of mirrors) {
  let current = ''
  try {
    current = readFileSync(path, 'utf8')
  } catch {
    current = ''
  }
  const name = path.slice(path.indexOf('packages/'))
  if (current === generated) continue
  if (check) {
    console.error(`${name} is stale. Run \`pnpm build:css\`.`)
    stale = true
    continue
  }
  writeFileSync(path, generated)
  console.log(`wrote ${name}`)
}

if (stale) process.exit(1)
if (check) console.log('every css.ts is up to date')
