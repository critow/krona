// Documentation drifts silently: a prop gets added, the README does not, and
// nobody notices until someone goes looking for it. This walks the public
// surface out of the source and fails when a README stops mentioning part of it.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const read = (path) => readFileSync(fileURLToPath(new URL(`../${path}`, import.meta.url)), 'utf8')

/** Names declared inside the first `interface <name>` block of a file. */
function membersOf(source, interfaceName) {
  const start = source.indexOf(`interface ${interfaceName} `)
  if (start === -1) throw new Error(`interface ${interfaceName} not found`)
  const open = source.indexOf('{', start)
  let depth = 0
  let end = open
  for (let i = open; i < source.length; i++) {
    if (source[i] === '{') depth++
    else if (source[i] === '}' && --depth === 0) {
      end = i
      break
    }
  }
  const body = source.slice(open + 1, end)
  const names = new Set()
  for (const line of body.split('\n')) {
    const match = /^\s*(?:readonly\s+)?([a-zA-Z][a-zA-Z0-9]*)\??[?]?\s*[:(]/.exec(line)
    if (match?.[1]) names.add(match[1])
  }
  return names
}

const SOURCES = [
  ['packages/react/src/KronaRoot.tsx', 'KronaRootProps'],
  ['packages/react/src/viewer/Viewer.tsx', 'KronaViewerProps'],
  ['packages/react/src/diff/Diff.tsx', 'KronaDiffProps'],
  ['packages/react/src/diff/Diff.tsx', 'CollapseUnchangedOptions'],
  ['packages/react/src/labels.ts', 'KronaLabels'],
  ['packages/core/src/model/types.ts', 'ParseLimits'],
]

// Documented as a group rather than one row each, or intentionally internal.
const EXEMPT = new Set(['children', 'className', 'style'])

// The core's exported functions are part of the contract too, and the walk
// above never looked at them: it reads props interfaces and CSS variables, so
// a core export could always land undocumented without anyone noticing. These
// are the ones that already had. The list is a baseline, not a permission —
// its job is to stop the next one being added, and it may only ever shrink.
const CORE_DEBT = new Set([
  'DEFAULT_LIMITS',
  'OffsetIndex',
  'applyEdit',
  'blockSpanAt',
  'defaultRegistry',
  'detectFormat',
  'diffLineArrays',
  'duplicateBlockEdit',
  'expandRegion',
  'formattedEdit',
  'getFormat',
  'hasUnsafeCharacters',
  'hiddenCount',
  'hiddenRowSet',
  'iniProvider',
  'joinPath',
  'jsonProvider',
  'lineSpanAt',
  'listFormats',
  'matchAfter',
  'minimalEdit',
  'nextChangedRow',
  'offsetOfLine',
  'pathSegmentOf',
  'previousChangedRow',
  'registerFormat',
  'removeBlockEdit',
  'similarityOf',
  'splitLines',
  'textProvider',
  'tokenizeWords',
  'tomlProvider',
  'unregisterFormat',
  'valueSpansAt',
])

/** Value exports of the core's entry point. `export type` blocks are skipped. */
function coreExports(source) {
  const names = new Set()
  for (const block of source.matchAll(/export \{([\s\S]*?)\} from/g)) {
    for (const entry of block[1].split(',')) {
      const name = entry
        .trim()
        .split(/\s+as\s+/)
        .pop()
        ?.trim()
      if (name) names.add(name)
    }
  }
  return names
}

const expected = new Set()
for (const [path, name] of SOURCES) {
  for (const member of membersOf(read(path), name)) {
    if (!EXEMPT.has(member)) expected.add(member)
  }
}

for (const name of coreExports(read('packages/core/src/index.ts'))) {
  if (!CORE_DEBT.has(name)) expected.add(name)
}

for (const variable of read('packages/react/src/theme/krona.css').matchAll(/--krona-[a-z-]+/g)) {
  expected.add(variable[0])
}
expected.add('--krona-height')

// Token colours and diff shades are listed by a shared prefix plus suffixes.
const GROUPED = /^--krona-token-|^--krona-(added|removed)-/

// One set of documents per language: the README is the tour and the reference
// page is the index, and a name may be documented in either. Checked per
// language so a translation cannot quietly fall behind.
const DOCS = [
  ['README.md', 'docs/reference.md'],
  ['README.ru.md', 'docs/reference.ru.md'],
]
let failed = false

for (const paths of DOCS) {
  const text = paths.map(read).join('\n')
  const missing = [...expected]
    .filter((name) => !text.includes(name))
    .filter((name) => !(GROUPED.test(name) && text.includes(name.replace(/^--krona-[a-z]+/, ''))))
    .sort()
  const where = paths.join(' + ')
  if (missing.length > 0) {
    failed = true
    console.error(`${where} do not mention: ${missing.join(', ')}`)
  } else {
    console.log(`${where}: all ${expected.size} public names documented`)
  }
}

if (failed) {
  console.error(
    '\nAdd the missing names to the reference tables, or to EXEMPT if they are covered as a group.',
  )
  process.exit(1)
}
