import { Krona } from 'krona'
import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-react'
import { unifiedEntries } from './unifiedRows'

const BEFORE = [
  '{',
  '  "name": "krona",',
  '  "server": {',
  '    "host": "0.0.0.0",',
  '    "port": 8080',
  '  },',
  '  "gone": true',
  '}',
].join('\n')

const AFTER = [
  '{',
  '  "name": "krona",',
  '  "server": {',
  '    "host": "127.0.0.1",',
  '    "port": 8080',
  '  },',
  '  "added": 1',
  '}',
].join('\n')

function unifiedRows(container: HTMLElement): { line: string; tone: string; text: string }[] {
  return [...container.querySelectorAll('.krona-panel--unified .krona-lines .krona-row')].map(
    (row) => ({
      line: row.getAttribute('data-line') ?? 'spacer',
      tone:
        [...row.classList].find(
          (name) => name.startsWith('krona-row--') && name !== 'krona-row--actionable',
        ) ?? '',
      text: row.textContent ?? '',
    }),
  )
}

describe('unifiedEntries', () => {
  const rows = [
    { left: 0, right: 0, kind: 'equal' as const },
    { left: 1, right: 1, kind: 'changed' as const },
    { left: 2, right: null, kind: 'removed' as const },
    { left: null, right: 2, kind: 'added' as const },
    // A spacer keeps two panels level; one column has nothing to stay level with.
    { left: null, right: null, kind: 'equal' as const },
  ]

  it('reads a changed row twice, old line above new', () => {
    const entries = unifiedEntries(
      rows.map((_, rowIndex) => ({ rowIndex })),
      rows,
    )
    expect(entries).toEqual([
      { rowIndex: 0, side: 'right' },
      { rowIndex: 1, side: 'left' },
      { rowIndex: 1, side: 'right' },
      { rowIndex: 2, side: 'left' },
      { rowIndex: 3, side: 'right' },
    ])
  })

  it('keeps expand bars, which belong to neither version', () => {
    const entries = unifiedEntries([{ rowIndex: -1, regionIndex: 2 }], rows)
    expect(entries).toEqual([{ rowIndex: -1, regionIndex: 2 }])
  })
})

describe('Krona.Diff view="unified"', () => {
  it('puts both versions in one column, the removed line above the added one', async () => {
    const screen = await render(
      <Krona format="json" narrowWidth={0}>
        <Krona.Diff left={BEFORE} right={AFTER} view="unified" />
      </Krona>,
    )

    await expect.poll(() => unifiedRows(screen.container).length).toBeGreaterThan(0)
    expect(screen.container.querySelectorAll('.krona-panel').length).toBe(1)

    const rows = unifiedRows(screen.container)
    const host = rows.findIndex((row) => row.text.includes('0.0.0.0'))
    expect(host).toBeGreaterThanOrEqual(0)
    expect(rows[host]?.tone).toBe('krona-row--removed')
    expect(rows[host + 1]?.text).toContain('127.0.0.1')
    expect(rows[host + 1]?.tone).toBe('krona-row--added')

    // Each line keeps its own version's number: the removed line is the old
    // file's line 4, the line that replaced it is the new file's line 4.
    expect(rows[host]?.line).toBe('4')
    expect(rows[host + 1]?.line).toBe('4')

    // A line only one version has appears once, and nothing is a spacer: there
    // is no second column left to keep level.
    expect(rows.some((row) => row.text.includes('"gone"'))).toBe(true)
    expect(rows.some((row) => row.text.includes('"added"'))).toBe(true)
    expect(rows.every((row) => row.tone !== 'krona-row--spacer')).toBe(true)
  })

  it('folds a block from the version the row belongs to', async () => {
    const screen = await render(
      <Krona format="json" narrowWidth={0}>
        <Krona.Diff left={BEFORE} right={AFTER} view="unified" />
      </Krona>,
    )
    await expect.poll(() => unifiedRows(screen.container).length).toBeGreaterThan(0)

    const before = unifiedRows(screen.container).length
    const toggles = screen.container.querySelectorAll<HTMLElement>(
      '.krona-panel--unified .krona-fold-toggle',
    )
    const server = [...toggles].find((toggle) => toggle.textContent?.includes('3'))
    expect(server).toBeDefined()
    if (!server) return
    server.click()

    await expect.poll(() => unifiedRows(screen.container).length).toBeLessThan(before)
    expect(unifiedRows(screen.container).some((row) => row.text.includes('{ 2 items }'))).toBe(true)
  })

  it('takes the whole column on a narrow root, with no side switch to press', async () => {
    const screen = await render(
      <div style={{ width: 360 }}>
        <Krona format="json" narrowWidth={640}>
          <Krona.Diff left={BEFORE} right={AFTER} />
        </Krona>
      </div>,
    )

    // The width is measured, not guessed, so the layout arrives a frame in.
    await expect
      .poll(() => screen.container.querySelectorAll('.krona-panel--unified').length)
      .toBe(1)
    expect(screen.container.querySelector('.krona-side-switch')).toBe(null)
  })

  it('stays side by side on a narrow root when asked to', async () => {
    const screen = await render(
      <div style={{ width: 360 }}>
        <Krona format="json" narrowWidth={640}>
          <Krona.Diff left={BEFORE} right={AFTER} view="split" />
        </Krona>
      </div>,
    )
    await expect.poll(() => screen.container.querySelectorAll('.krona-panel').length).toBe(1)
    expect(screen.container.querySelector('.krona-panel--unified')).toBe(null)
    expect(screen.container.querySelector('.krona-side-switch')).not.toBe(null)
  })
})
