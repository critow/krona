import { alignDiff, diffLines, intralineDiff, parseDocument } from '@krona/core'
import { bench, describe } from 'vitest'
import '../index'

/**
 * A stand-in for the file this budget was written against: two versions of a
 * ~60k line package-lock.json. Generated rather than committed so the repo
 * stays small and the benchmark stays deterministic.
 */
function lockfile(seed: number, packages = 4000): string {
  const lines: string[] = ['{', '  "name": "app",', '  "lockfileVersion": 3,', '  "packages": {']
  for (let i = 0; i < packages; i++) {
    const patch = (i * seed) % 20
    lines.push(
      `    "node_modules/pkg-${i}": {`,
      `      "version": "1.${i % 30}.${patch}",`,
      `      "resolved": "https://registry.npmjs.org/pkg-${i}/-/pkg-${i}-1.${i % 30}.${patch}.tgz",`,
      `      "integrity": "sha512-${(i * 2654435761 * seed).toString(16).padStart(24, '0')}",`,
      '      "dependencies": {',
      `        "pkg-${(i + 1) % packages}": "^1.0.0"`,
      '      }',
      i === packages - 1 ? '    }' : '    },',
    )
  }
  lines.push('  }', '}')
  return lines.join('\n')
}

const left = lockfile(1)
const right = lockfile(3)
const leftLines = left.split('\n')

describe('package-lock scale', () => {
  bench('parse 60k lines', () => {
    parseDocument(left, 'json')
  })

  bench('diff two 60k-line versions', () => {
    diffLines(left, right)
  })

  bench('align a 60k-line diff', () => {
    alignDiff(diffLines(left, right))
  })

  bench('tokenize one viewport (60 lines)', () => {
    const model = parseDocument(left, 'json')
    for (let i = 1000; i < 1060; i++) model.tokensAt(i)
  })

  bench('word diff one viewport of changed lines', () => {
    for (let i = 1000; i < 1060; i++) {
      intralineDiff(leftLines[i] ?? '', (leftLines[i] ?? '').replace('1.', '2.'))
    }
  })
})
