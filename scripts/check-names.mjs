// Filenames that only a case-sensitive filesystem tells apart. Linux CI is the
// one machine where such a pair is harmless, so nothing here catches itself:
// this ran green while `pnpm build` was broken on every Mac.
//
// Two ways a name can go wrong:
//
//  1. Two paths equal but for case cannot both exist in a checkout on macOS or
//     Windows. Git writes one over the other and the working tree is wrong
//     before a build ever starts.
//  2. Two modules in one directory whose names differ only by case once the
//     extension is dropped make an extensionless `import './x'` ambiguous, and
//     the resolvers disagree about which one wins. rolldown, which tsdown
//     builds on, probes `['.tsx', '.ts', '.jsx', '.js', '.json']` in that
//     order; vite probes `.ts` before `.tsx`. So `unified.ts` beside
//     `Unified.tsx` resolved to the helper under vitest and to the component
//     under `pnpm build` — but only where the filesystem ignores case.
import { execFileSync } from 'node:child_process'

/** Extensions a bare specifier can pick up on its own. */
const MODULE = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs|json)$/

const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
  .split('\0')
  .filter(Boolean)

/** Groups keyed by a name with the case flattened out, values the real ones. */
function groupBy(paths, keyOf) {
  const groups = new Map()
  for (const path of paths) {
    const key = keyOf(path)
    if (key === null) continue
    const group = groups.get(key)
    if (group) group.push(path)
    else groups.set(key, [path])
  }
  return [...groups.values()].filter((group) => group.length > 1)
}

const sameFile = groupBy(files, (path) => path.toLowerCase())

// The whole path without its extension: two modules collide only when they sit
// in the same directory, and keeping the directory in the key says so.
const sameModule = groupBy(
  files.filter((path) => MODULE.test(path)),
  (path) => path.replace(MODULE, '').toLowerCase(),
)

let failed = false

for (const group of sameFile) {
  failed = true
  console.error(`Paths that differ only by case: ${group.join(', ')}`)
  console.error('  A checkout on macOS or Windows keeps only one of them.\n')
}

for (const group of sameModule) {
  // A pair caught above is already reported; saying it twice helps nobody.
  if (sameFile.some((other) => other.some((path) => group.includes(path)))) continue
  failed = true
  console.error(`Modules an extensionless import cannot tell apart: ${group.join(', ')}`)
  console.error('  Give one a different name, not a different case.\n')
}

if (failed) {
  console.error('Rename the file rather than relying on the filesystem to keep the two apart.')
  process.exit(1)
}

console.log(`${files.length} tracked files, no name resolves two ways`)
