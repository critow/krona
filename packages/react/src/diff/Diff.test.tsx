import { Krona } from 'krona'
import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-react'

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
  '  "added": 1,',
  '  "extra": 2',
  '}',
].join('\n')

function rowsOf(container: HTMLElement, side: 'left' | 'right'): string[] {
  return [...container.querySelectorAll(`.krona-panel--${side} .krona-lines .krona-row`)].map(
    (row) => row.getAttribute('data-line') ?? 'spacer',
  )
}

function toneOf(container: HTMLElement, side: 'left' | 'right'): string[] {
  return [...container.querySelectorAll(`.krona-panel--${side} .krona-lines .krona-row`)].map(
    (row) =>
      [...row.classList].find(
        (name) => name.startsWith('krona-row--') && name !== 'krona-row--actionable',
      ) ?? '',
  )
}

async function renderDiff(props: Record<string, unknown> = {}) {
  return render(
    <Krona format="json">
      <Krona.Diff left={BEFORE} right={AFTER} {...props} />
    </Krona>,
  )
}

describe('Krona.Diff', () => {
  it('renders both panels with the same number of rows', async () => {
    const screen = await renderDiff()
    await expect.poll(() => rowsOf(screen.container, 'left').length).toBeGreaterThan(0)
    expect(rowsOf(screen.container, 'left').length).toBe(rowsOf(screen.container, 'right').length)
  })

  it('puts a spacer opposite an added line so the sides stay level', async () => {
    const screen = await renderDiff()
    // 3 equal, 1 changed, 2 equal, 1 removed, 2 added, 1 equal.
    await expect.poll(() => rowsOf(screen.container, 'left').length).toBe(10)
    const left = rowsOf(screen.container, 'left')
    const right = rowsOf(screen.container, 'right')
    // Two added lines leave two gaps on the left, one removed line leaves one
    // gap on the right.
    expect(left.filter((value) => value === 'spacer')).toHaveLength(2)
    expect(right.filter((value) => value === 'spacer')).toHaveLength(1)
    // Every row index lines up: a spacer on one side faces a real line on the other.
    for (let i = 0; i < left.length; i++) {
      expect(left[i] === 'spacer' && right[i] === 'spacer').toBe(false)
    }
  })

  it('paints removed, added and changed rows differently', async () => {
    const screen = await renderDiff()
    await expect.poll(() => toneOf(screen.container, 'left').length).toBeGreaterThan(0)
    expect(toneOf(screen.container, 'left')).toContain('krona-row--changed')
    expect(toneOf(screen.container, 'right')).toContain('krona-row--added')
    expect(toneOf(screen.container, 'left')).toContain('krona-row--removed')
  })

  it('highlights only the changed fragment inside a changed line', async () => {
    const screen = await renderDiff()
    await expect
      .poll(() => screen.container.querySelectorAll('.krona-intraline').length)
      .toBeGreaterThan(0)
    const highlighted = [...screen.container.querySelectorAll('.krona-intraline')].map(
      (node) => node.textContent,
    )
    expect(highlighted.join(' ')).toContain('0.0.0.0')
    expect(highlighted.join(' ')).toContain('127.0.0.1')
  })

  it('keeps the panels in lockstep when one is scrolled', async () => {
    const long = (marker: string) =>
      `{\n${Array.from({ length: 2000 }, (_, i) => `  "k${i}": "${marker}${i}",`).join('\n')}\n  "z": 1\n}`
    const screen = await render(
      <Krona format="json">
        <Krona.Diff left={long('a')} right={long('b')} />
      </Krona>,
    )
    const [leftScroll, rightScroll] = [
      ...screen.container.querySelectorAll<HTMLElement>('.krona-scroll'),
    ]
    expect(leftScroll).toBeDefined()
    expect(rightScroll).toBeDefined()
    if (!leftScroll || !rightScroll) return

    leftScroll.scrollTop = 4000
    await expect.poll(() => rightScroll.scrollTop).toBe(4000)

    rightScroll.scrollTop = 1200
    await expect.poll(() => leftScroll.scrollTop).toBe(1200)
  })

  it('keeps the panels in step horizontally, at a width the whole document sets', async () => {
    // The one wide line sits at the very bottom, far outside the first
    // viewport: if the reserved width came from the rendered rows alone, there
    // would be nothing to scroll horizontally at all.
    const wide = (marker: string) =>
      [
        '{',
        ...Array.from({ length: 2000 }, (_, i) => `  "k${i}": "${marker}",`),
        `  "long": "${marker.repeat(300)}"`,
        '}',
      ].join('\n')
    const screen = await render(
      <Krona format="json">
        <Krona.Diff left={wide('a')} right={wide('b')} />
      </Krona>,
    )
    const [leftScroll, rightScroll] = [
      ...screen.container.querySelectorAll<HTMLElement>('.krona-scroll'),
    ]
    expect(leftScroll).toBeDefined()
    expect(rightScroll).toBeDefined()
    if (!leftScroll || !rightScroll) return

    await expect.poll(() => leftScroll.scrollWidth > leftScroll.clientWidth).toBe(true)
    expect(leftScroll.scrollWidth).toBe(rightScroll.scrollWidth)

    leftScroll.scrollLeft = 120
    await expect.poll(() => rightScroll.scrollLeft).toBe(120)

    rightScroll.scrollLeft = 40
    await expect.poll(() => leftScroll.scrollLeft).toBe(40)
  })

  it('folds the matching range in both panels at once', async () => {
    const screen = await renderDiff()
    await expect.poll(() => rowsOf(screen.container, 'left').length).toBe(10)
    const before = rowsOf(screen.container, 'left').length

    await screen.getByRole('button', { name: 'Collapse block' }).nth(1).click()

    await expect.poll(() => rowsOf(screen.container, 'left').length).toBeLessThan(before)
    expect(rowsOf(screen.container, 'left').length).toBe(rowsOf(screen.container, 'right').length)
  })

  it('hides long unchanged runs behind an expand bar', async () => {
    const filler = Array.from({ length: 40 }, (_, i) => `  "same${i}": ${i},`).join('\n')
    const left = `{\n  "head": 1,\n${filler}\n  "tail": 1\n}`
    const right = `{\n  "head": 2,\n${filler}\n  "tail": 1\n}`
    const screen = await render(
      <Krona format="json">
        <Krona.Diff left={left} right={right} collapseUnchanged />
      </Krona>,
    )
    await expect
      .poll(() => screen.container.querySelectorAll('.krona-expand-bar').length)
      .toBeGreaterThan(0)
    const visible = () =>
      screen.container.querySelectorAll('.krona-panel--left .krona-lines .krona-row').length
    const collapsed = visible()
    expect(collapsed).toBeLessThan(20)

    await screen.getByRole('button', { name: 'Expand all' }).first().click()
    await expect.poll(visible).toBeGreaterThan(collapsed)
  })

  it('reveals a hidden run step by step from either end', async () => {
    const filler = Array.from({ length: 80 }, (_, i) => `  "same${i}": ${i},`).join('\n')
    const screen = await render(
      <Krona format="json">
        <Krona.Diff
          left={`{\n  "head": 1,\n${filler}\n  "tail": 1\n}`}
          right={`{\n  "head": 2,\n${filler}\n  "tail": 1\n}`}
          collapseUnchanged={{ step: 10 }}
        />
      </Krona>,
    )
    const visible = () =>
      screen.container.querySelectorAll('.krona-panel--left .krona-lines .krona-row').length
    await expect.poll(() => screen.container.querySelectorAll('.krona-expand-bar').length).toBe(2)
    const start = visible()
    await screen.getByRole('button', { name: 'Expand up' }).first().click()
    await expect.poll(visible).toBe(start + 10)
    await screen.getByRole('button', { name: 'Expand down' }).first().click()
    await expect.poll(visible).toBe(start + 20)
  })

  it('exposes the expand controls once, not once per panel', async () => {
    const filler = Array.from({ length: 40 }, (_, i) => `  "same${i}": ${i},`).join('\n')
    const screen = await render(
      <Krona format="json">
        <Krona.Diff
          left={`{\n  "head": 1,\n${filler}\n  "tail": 1\n}`}
          right={`{\n  "head": 2,\n${filler}\n  "tail": 1\n}`}
          collapseUnchanged
        />
      </Krona>,
    )
    await expect.poll(() => screen.container.querySelectorAll('.krona-expand-bar').length).toBe(2)
    const named = screen.container.querySelectorAll('.krona-expand-bar:not([aria-hidden]) button')
    const hidden = screen.container.querySelectorAll('.krona-expand-bar[aria-hidden] button')
    expect(named.length).toBeGreaterThan(0)
    expect(hidden.length).toBe(named.length)
    expect([...hidden].every((button) => button.getAttribute('tabindex') === '-1')).toBe(true)
  })

  it('marks the changes on the minimap', async () => {
    const screen = await render(
      <Krona format="json">
        <Krona.Diff left={BEFORE} right={AFTER} showMinimap />
      </Krona>,
    )
    await expect
      .poll(() => screen.container.querySelectorAll('.krona-minimap-mark').length)
      .toBeGreaterThan(0)
  })

  it('treats reordered keys as a real difference', async () => {
    const screen = await render(
      <Krona format="json">
        <Krona.Diff left={'{\n  "a": 1,\n  "b": 2\n}'} right={'{\n  "b": 2,\n  "a": 1\n}'} />
      </Krona>,
    )
    await expect
      .poll(
        () =>
          screen.container.querySelectorAll(
            '.krona-row--added, .krona-row--removed, .krona-row--changed',
          ).length,
      )
      .toBeGreaterThan(0)
  })

  it('reports the counts in the toolbar', async () => {
    const screen = await render(
      <Krona format="json">
        <Krona.Diff left={BEFORE} right={AFTER}>
          <Krona.Toolbar />
          <Krona.Panel side="left" />
          <Krona.Panel side="right" />
        </Krona.Diff>
      </Krona>,
    )
    await expect.element(screen.getByRole('toolbar')).toBeVisible()
    expect(screen.container.querySelector('.krona-stat--added')?.textContent).toMatch(/\d/)
  })
})
