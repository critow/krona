// Writes the built demo back to disk with its markup already in place.
//
//   pnpm --filter krona-playground build && node scripts/prerender.mjs
//
// The page is a client-rendered app, so what a crawler fetches is an empty
// `<div id="root">` and a script tag. Google runs the script eventually;
// Bing, the social scrapers and the crawlers behind LLM search read the HTML
// they were given and move on. A library nobody can find is a library nobody
// installs, so the built page ships with its own content.
//
// The app still boots and takes the page over — React clears the container and
// renders the same tree, so this buys the first paint and the crawler, not a
// second implementation to keep in step. Krona's own stylesheet is captured
// with it, and `injectStyles` is a no-op once `#krona-styles` is present, so
// the static markup arrives styled rather than flashing.
import { spawn } from 'node:child_process'
import { readFile, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright'

const PORT = 5302
const OUT = 'playground/dist/index.html'
const BASE = process.env.KRONA_BASE ?? '/'

// A prerender that quietly produced an empty page would be worse than none: it
// would look done. The floor is far below what the demo renders and far above
// what an unrendered shell contains.
const MIN_TEXT = 500

/** Waits for the preview server to answer, or gives up rather than hang CI. */
async function waitForServer(url, attempts = 40) {
  for (let i = 0; i < attempts; i++) {
    try {
      const response = await fetch(url)
      if (response.ok) return
    } catch {
      // Not up yet; the loop is the retry.
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error(`${url} never answered`)
}

const before = (await readFile(OUT, 'utf8')).length

const server = spawn(
  'pnpm',
  [
    '--filter',
    'krona-playground',
    'exec',
    'vite',
    'preview',
    '--port',
    String(PORT),
    '--strictPort',
    '--host',
    '127.0.0.1',
  ],
  { stdio: 'ignore' },
)

try {
  const url = `http://127.0.0.1:${PORT}${BASE}`
  await waitForServer(url)

  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  await page.goto(url, { waitUntil: 'networkidle' })
  // Rows are the proof the library itself ran, not merely that React mounted.
  await page.waitForSelector('.krona-row')

  const text = (await page.locator('body').innerText()).trim()
  if (text.length < MIN_TEXT) {
    throw new Error(
      `the rendered page holds ${text.length} characters of text, expected ${MIN_TEXT}+`,
    )
  }

  const html = await page.evaluate(() => document.documentElement.outerHTML)
  await browser.close()

  // `outerHTML` starts at <html>; the doctype is a sibling of it.
  await writeFile(OUT, `<!doctype html>\n${html}\n`, 'utf8')
  console.log(
    `wrote ${OUT}: ${before} -> ${(await readFile(OUT, 'utf8')).length} bytes, ` +
      `${text.length} characters of text`,
  )
} finally {
  server.kill()
}
