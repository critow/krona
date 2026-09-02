import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'vite'
import { afterAll, describe, expect, it } from 'vitest'

/**
 * These tests bundle Krona the way a consumer's build does, then run the
 * result. Importing the entry point in Node proves nothing about it: Node never
 * tree-shakes, so a registration a bundler had dropped still appears to work.
 *
 * The bug this guards against shipped once. Providers register themselves from
 * module scope, both packages declared `sideEffects: false`, and every
 * production build silently discarded the registrations — documents rendered as
 * unhighlighted plain text with nothing to fold, while the dev server, the unit
 * tests and the screenshot suite all stayed green.
 */

const repoRoot = new URL('../../../', import.meta.url).pathname
const src = (path: string) => join(repoRoot, path)

const alias = [
  { find: /^@kronajs\/core$/, replacement: src('packages/core/src/index.ts') },
  {
    find: /^@kronajs\/core\/(json|yaml|toml|ini)$/,
    replacement: `${src('packages/core/src/formats/')}$1.ts`,
  },
]

const tempDirs: string[] = []

afterAll(async () => {
  await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })))
})

interface Bundle {
  readonly code: string
  readonly ids: readonly string[]
}

async function bundleAndRun(entrySource: string): Promise<Bundle> {
  const dir = await mkdtemp(join(tmpdir(), 'krona-bundle-'))
  tempDirs.push(dir)
  const entry = join(dir, 'entry.mjs')
  await writeFile(entry, entrySource, 'utf8')

  await build({
    root: dir,
    logLevel: 'silent',
    resolve: { alias },
    build: {
      outDir: join(dir, 'dist'),
      minify: false,
      lib: { entry, formats: ['es'], fileName: 'out' },
    },
  })

  const file = join(dir, 'dist', 'out.mjs')
  const code = await readFile(file, 'utf8')
  const module: { ids: readonly string[] } = await import(pathToFileURL(file).href)
  return { code, ids: module.ids }
}

// Each of these runs a real production build, which is the point and is not
// fast; under coverage instrumentation it crosses vitest's default five
// seconds. Raised for the suite rather than for whichever test noticed first.
const BUILD_TIMEOUT = 60_000

describe('bundled entry points', { timeout: BUILD_TIMEOUT }, () => {
  it('keeps the built-in providers registered through a production build', async () => {
    const { ids } = await bundleAndRun(
      `import { listFormats } from '@kronajs/core'
       export const ids = listFormats().map((provider) => provider.id)`,
    )

    expect([...ids].sort()).toEqual(['ini', 'json', 'text', 'toml'])
  })

  it('registers YAML when the consumer imports it for its side effect alone', async () => {
    const { ids } = await bundleAndRun(
      `import { listFormats } from '@kronajs/core'
       import '@kronajs/core/yaml'
       export const ids = listFormats().map((provider) => provider.id)`,
    )

    expect([...ids].sort()).toEqual(['ini', 'json', 'text', 'toml', 'yaml'])
  })

  it('leaves the YAML parser out of a bundle that never imports it', async () => {
    const { code } = await bundleAndRun(
      `import { listFormats } from '@kronajs/core'
       export const ids = listFormats().map((provider) => provider.id)`,
    )

    // A tag URI the `yaml` package carries for its schema definitions: present
    // whenever the parser is in the bundle, absent when it has been shaken out.
    expect(code).not.toContain('tag:yaml.org,2002:')
  })
})
