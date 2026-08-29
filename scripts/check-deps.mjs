// Supply-chain guard: the published runtime dependency graph must stay tiny and
// auditable. Any new transitive dependency is a deliberate decision, not a surprise.
import { execFileSync } from 'node:child_process'

const ALLOWED = new Set([
  'diff',
  'jsonc-parser',
  'yaml',
  '@tanstack/react-virtual',
  '@tanstack/virtual-core',
  '@kronajs/core',
  // peer dependencies, provided by the consumer
  'react',
  'react-dom',
  'scheduler',
])

function collect(filter) {
  const raw = execFileSync(
    'pnpm',
    ['--filter', filter, 'list', '--prod', '--depth', 'Infinity', '--json'],
    { encoding: 'utf8' },
  )
  const found = new Set()
  const walk = (deps) => {
    for (const [name, info] of Object.entries(deps ?? {})) {
      found.add(name)
      walk(info.dependencies)
    }
  }
  for (const project of JSON.parse(raw)) walk(project.dependencies)
  return found
}

let failed = false
for (const pkg of ['@kronajs/core', 'krona']) {
  const found = collect(pkg)
  const unexpected = [...found].filter((name) => !ALLOWED.has(name)).sort()
  if (unexpected.length > 0) {
    failed = true
    console.error(`${pkg}: unexpected runtime dependencies: ${unexpected.join(', ')}`)
  } else {
    console.log(`${pkg}: ${found.size} runtime dependencies, all allow-listed`)
  }
}

if (failed) {
  console.error('\nAdd the dependency to ALLOWED in scripts/check-deps.mjs only after review.')
  process.exit(1)
}
