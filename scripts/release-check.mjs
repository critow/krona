// A tag is a claim about the repository; this checks the repository agrees with
// it before anything reaches npm, where a version can never be taken back.
//
//   node scripts/release-check.mjs 0.1.0 [--notes-out <file>]
//
// Every published package must carry the version, and the changelog must have a
// section for it — which is also where the release notes come from, so the
// notes cannot drift from what shipped.
import { readFileSync, writeFileSync } from 'node:fs'

const [version, ...rest] = process.argv.slice(2)
if (!version || !/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version)) {
  console.error('usage: node scripts/release-check.mjs <version> [--notes-out <file>]')
  process.exit(2)
}

const notesOut = rest[0] === '--notes-out' ? rest[1] : undefined
const problems = []

for (const path of [
  'packages/core/package.json',
  'packages/react/package.json',
  'packages/element/package.json',
]) {
  const pkg = JSON.parse(readFileSync(path, 'utf8'))
  if (pkg.version !== version) {
    problems.push(`${path} is ${pkg.version}, tag says ${version}`)
  }
}

/**
 * The section of the changelog that documents one version.
 *
 * Headings are matched by the version they name rather than by an exact form,
 * so `## 0.1.0 — 2026-08-25` and `## Unreleased — \`0.1.0\`` both answer. A
 * release with no section of its own fails: shipping a version nobody wrote
 * down is the thing this guards against.
 */
function changelogSection(text) {
  const lines = text.split('\n')
  const start = lines.findIndex((line) => line.startsWith('## ') && line.includes(version))
  if (start === -1) return null
  let end = lines.length
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i]?.startsWith('## ')) {
      end = i
      break
    }
  }
  return lines
    .slice(start + 1, end)
    .join('\n')
    .trim()
}

const notes = changelogSection(readFileSync('CHANGELOG.md', 'utf8'))
if (notes === null) {
  problems.push(`CHANGELOG.md has no section naming ${version}`)
} else if (notes === '') {
  problems.push(`the CHANGELOG.md section for ${version} is empty`)
}

if (problems.length > 0) {
  console.error(`Not ready to release ${version}:`)
  for (const problem of problems) console.error(`  - ${problem}`)
  process.exit(1)
}

if (notesOut) writeFileSync(notesOut, `${notes}\n`)
console.log(
  `${version}: versions match and the changelog has ${notes.split('\n').length} lines for it`,
)
