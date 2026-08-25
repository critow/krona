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

const expected = new Set()
for (const [path, name] of SOURCES) {
  for (const member of membersOf(read(path), name)) {
    if (!EXEMPT.has(member)) expected.add(member)
  }
}

for (const variable of read('packages/react/src/theme/krona.css').matchAll(/--krona-[a-z-]+/g)) {
  expected.add(variable[0])
}
expected.add('--krona-height')

// Token colours and diff shades are listed by a shared prefix plus suffixes.
const GROUPED = /^--krona-token-|^--krona-(added|removed)-/

const READMES = ['README.md', 'README.ru.md']
let failed = false

for (const readme of READMES) {
  const text = read(readme)
  const missing = [...expected]
    .filter((name) => !text.includes(name))
    .filter((name) => !(GROUPED.test(name) && text.includes(name.replace(/^--krona-[a-z]+/, ''))))
    .sort()
  if (missing.length > 0) {
    failed = true
    console.error(`${readme} does not mention: ${missing.join(', ')}`)
  } else {
    console.log(`${readme}: all ${expected.size} public names documented`)
  }
}

if (failed) {
  console.error(
    '\nAdd the missing names to the reference tables, or to EXEMPT if they are covered as a group.',
  )
  process.exit(1)
}
