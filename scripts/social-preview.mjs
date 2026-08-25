// Builds the 1280×640 card GitHub shows when someone shares the repository, and
// the demo hands to a chat client as `og:image`.
//
//   pnpm build:social
//
// The diff on the card is a screenshot of the real demo, not a mock-up: the
// card is a claim about what the library looks like, and the cheapest way to
// keep that claim true is to photograph the thing itself. Which means this
// wants the playground built first — `pnpm build:social` does that.
import { spawn } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { copyFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium } from 'playwright'

const PORT = 5301
const OUT = 'playground/public/social-preview.png'
const work = mkdtempSync(join(tmpdir(), 'krona-social-'))

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
  const base = `http://127.0.0.1:${PORT}/krona/`
  await waitForServer(base)

  const browser = await chromium.launch()
  const page = await browser.newPage({
    viewport: { width: 1400, height: 900 },
    deviceScaleFactor: 2,
  })

  await page.goto(`${base}?mode=diff&sample=json`)
  await page.waitForSelector('.krona-panel--right .krona-row')
  // Layout settles a frame after the panels measure themselves.
  await page.waitForTimeout(600)
  const diff = await page.locator('.krona-diff').first().boundingBox()
  if (!diff) throw new Error('the demo rendered no diff to photograph')
  const shot = join(work, 'diff.png')
  await page.screenshot({
    path: shot,
    clip: {
      x: diff.x,
      y: diff.y,
      width: Math.min(diff.width, 900),
      height: Math.min(diff.height, 440),
    },
  })

  await copyFile('docs/assets/logo-dark.svg', join(work, 'mark.svg'))
  await copyFile('playground/public/fonts/KronaSans-Bold.woff2', join(work, 'font.woff2'))
  writeFileSync(join(work, 'card.html'), card())

  const canvas = await browser.newPage({
    viewport: { width: 1280, height: 640 },
    // Rendered at 2×: every surface that shows this scales it down, and none
    // scale it up, so the larger file is the one that stays sharp.
    deviceScaleFactor: 2,
  })
  await canvas.goto(`file://${join(work, 'card.html')}`)
  await canvas.waitForTimeout(500)
  await canvas.screenshot({ path: OUT, clip: { x: 0, y: 0, width: 1280, height: 640 } })
  await browser.close()
  console.log(`wrote ${OUT}`)
} finally {
  server.kill()
}

function card() {
  return `<style>
  @font-face { font-family: "Krona Sans"; src: url("./font.woff2") format("woff2"); font-weight: 700; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  .card {
    width: 1280px; height: 640px; position: relative; overflow: hidden;
    background:
      radial-gradient(900px 420px at 88% 12%, rgba(92, 207, 230, 0.10), transparent 60%),
      radial-gradient(700px 380px at 4% 96%, rgba(78, 214, 154, 0.07), transparent 60%),
      #0b0e14;
    color: #d7dde8;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    display: flex; align-items: center;
  }
  .left { width: 560px; padding: 0 0 0 64px; flex: none; }
  .mark { width: 104px; height: 91px; display: block; margin-bottom: 26px; }
  .name { font-family: "Krona Sans"; font-size: 86px; line-height: 1; color: #f2f6ff; }
  .line { font-size: 27px; line-height: 1.35; margin-top: 22px; color: #d7dde8; }
  .modes { margin-top: 26px; display: flex; gap: 10px; }
  .pill { font-size: 17px; padding: 7px 15px; border: 1px solid #2f8ea3; border-radius: 999px;
    background: rgba(92, 207, 230, 0.14); color: #5ccfe6; }
  .formats { margin-top: 24px; font-size: 16px; color: #6b7688; letter-spacing: 0.04em; }
  .right { position: absolute; left: 596px; top: 74px; width: 760px; height: 492px; }
  .shot {
    width: 100%; height: 100%; object-fit: cover; object-position: left top;
    border: 1px solid #232c3d; border-radius: 14px 0 0 14px; border-right: none;
    box-shadow: -24px 30px 70px rgba(0, 0, 0, 0.55);
  }
  /* The panel runs off the right edge on purpose — a card is a window, not a
     screenshot. The fade makes the cut look intended rather than cropped. */
  .fade { position: absolute; inset: 0; border-radius: 14px 0 0 14px;
    background: linear-gradient(90deg, rgba(11,14,20,0) 55%, rgba(11,14,20,0.55) 82%, rgba(11,14,20,0.97) 100%); }
</style>
<div class="card">
  <div class="left">
    <img class="mark" src="./mark.svg">
    <div class="name">krona</div>
    <div class="line">Config files, unfolded.</div>
    <div class="modes"><span class="pill">Viewer</span><span class="pill">Diff</span><span class="pill">Edit</span></div>
    <div class="formats">JSON · YAML · TOML · INI/.env — for React</div>
  </div>
  <div class="right">
    <img class="shot" src="./diff.png">
    <div class="fade"></div>
  </div>
</div>
`
}
