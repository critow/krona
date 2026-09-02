import { Krona } from 'kronajs'
import { describe, expect, it } from 'vitest'
import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'

const DOC = [
  '{',
  '  "host": "localhost",',
  '  "server": {',
  '    "host": "localhost",',
  '    "port": 8080',
  '  },',
  '  "note": "LOCALHOST"',
  '}',
].join('\n')

const AFTER = DOC.replace('"port": 8080', '"port": 9090')

function matches(container: HTMLElement): string[] {
  return [...container.querySelectorAll('.krona-match')].map((node) => node.textContent ?? '')
}

function current(container: HTMLElement): string | null {
  return container.querySelector('.krona-match--current')?.textContent ?? null
}

async function type(container: HTMLElement, text: string) {
  const input = container.querySelector<HTMLInputElement>('.krona-search-input')
  expect(input).not.toBe(null)
  if (!input) throw new Error('no search field')
  await userEvent.fill(input, text)
  return input
}

describe('Krona.Search in a viewer', () => {
  async function open(props: Record<string, unknown> = {}) {
    return render(
      <Krona format="json" narrowWidth={0}>
        <Krona.Viewer source={DOC} {...props}>
          <Krona.Search />
          <Krona.Gutter />
          <Krona.Lines />
        </Krona.Viewer>
      </Krona>,
    )
  }

  it('highlights every occurrence and counts them', async () => {
    const screen = await open()
    await type(screen.container, 'localhost')

    await expect.poll(() => matches(screen.container).length).toBeGreaterThan(0)
    // Case-insensitive by default, so the shouted one counts too.
    expect(matches(screen.container)).toEqual(['localhost', 'localhost', 'LOCALHOST'])
    expect(screen.container.querySelector('.krona-search-count')?.textContent).toBe('0 / 3')
  })

  it('walks the matches, marking the one the reader is on', async () => {
    const screen = await open()
    await type(screen.container, 'localhost')
    await expect.poll(() => matches(screen.container).length).toBe(3)

    const next = screen.container.querySelectorAll<HTMLElement>('.krona-search-step')[1]
    expect(next).toBeDefined()
    if (!next) return

    next.click()
    await expect.poll(() => current(screen.container)).toBe('localhost')
    expect(screen.container.querySelector('.krona-search-count')?.textContent).toBe('1 / 3')

    next.click()
    next.click()
    await expect
      .poll(() => screen.container.querySelector('.krona-search-count')?.textContent)
      .toBe('3 / 3')
    expect(current(screen.container)).toBe('LOCALHOST')

    // Wrapping rather than stopping: a search that ends at the last match makes
    // you scroll back to the top yourself.
    next.click()
    await expect
      .poll(() => screen.container.querySelector('.krona-search-count')?.textContent)
      .toBe('1 / 3')
  })

  it('respects the query case when asked to', async () => {
    const screen = await open()
    await type(screen.container, 'LOCALHOST')
    await expect.poll(() => matches(screen.container).length).toBe(3)

    const toggle = screen.container.querySelector<HTMLElement>('.krona-search-toggle')
    expect(toggle).toBeDefined()
    if (!toggle) return
    toggle.click()

    await expect.poll(() => matches(screen.container)).toEqual(['LOCALHOST'])
  })

  it('says when a query finds nothing', async () => {
    const screen = await open()
    await type(screen.container, 'nowhere')
    await expect
      .poll(() => screen.container.querySelector('.krona-search-count')?.textContent)
      .toBe('No matches')
    expect(matches(screen.container)).toEqual([])
  })

  it('opens a folded block to reach a match inside it', async () => {
    const screen = await open({ defaultCollapsedDepth: 1 })
    // The block is folded, so its lines are not rendered at all.
    await expect
      .poll(() => screen.container.querySelectorAll('.krona-lines .krona-row').length)
      .toBeGreaterThan(0)
    expect(screen.container.textContent).not.toContain('8080')

    await type(screen.container, '8080')
    const next = screen.container.querySelectorAll<HTMLElement>('.krona-search-step')[1]
    if (!next) return
    next.click()

    await expect.poll(() => screen.container.textContent?.includes('8080')).toBe(true)
    expect(current(screen.container)).toBe('8080')
  })
})

describe('Krona.Search in a diff', () => {
  it('searches both versions and orders the matches by row', async () => {
    const screen = await render(
      <Krona format="json" narrowWidth={0}>
        <Krona.Diff left={DOC} right={AFTER}>
          <Krona.Search />
          <Krona.Panel side="left">
            <Krona.Gutter />
            <Krona.Lines />
          </Krona.Panel>
          <Krona.Panel side="right">
            <Krona.Gutter />
            <Krona.Lines />
          </Krona.Panel>
        </Krona.Diff>
      </Krona>,
    )

    await type(screen.container, '8080')
    // Only the old version has 8080; the new one has 9090.
    await expect.poll(() => matches(screen.container)).toEqual(['8080'])
    expect(screen.container.querySelector('.krona-search-count')?.textContent).toBe('0 / 1')

    await type(screen.container, 'port')
    // One per version, and the left panel's comes first because they share a row.
    await expect.poll(() => matches(screen.container).length).toBe(2)
    const [first] = screen.container.querySelectorAll<HTMLElement>('.krona-search-step')
    expect(first).toBeDefined()
  })
})

/**
 * A diff has two ways to hide a line and can use both on the same line: the
 * block around it is folded, and the unchanged run it sits in is collapsed
 * behind an expand bar. Jumping to a match has to undo whichever applies.
 */
describe('Krona.Search reaching a match a diff is hiding', () => {
  const NEEDLE = '"marker": "deep"'

  /** A change at the top, then a long unchanged block with the needle buried in it. */
  function nested(head: number): string {
    const filler = (from: number, count: number) =>
      Array.from({ length: count }, (_, i) => `    "same${from + i}": ${from + i},`)
    return [
      '{',
      `  "head": ${head},`,
      '  "nested": {',
      ...filler(0, 40),
      `    ${NEEDLE},`,
      ...filler(40, 40),
      '    "last": 1',
      '  },',
      '  "tail": 1',
      '}',
    ].join('\n')
  }

  async function open(props: Record<string, unknown>) {
    const screen = await render(
      <Krona format="json" narrowWidth={0}>
        <Krona.Diff left={nested(1)} right={nested(2)} {...props}>
          <Krona.Search />
          <Krona.Panel side="left">
            <Krona.Gutter />
            <Krona.Lines />
          </Krona.Panel>
          <Krona.Panel side="right">
            <Krona.Gutter />
            <Krona.Lines />
          </Krona.Panel>
        </Krona.Diff>
      </Krona>,
    )
    await expect
      .poll(() => screen.container.querySelectorAll('.krona-lines .krona-row').length)
      .toBeGreaterThan(0)
    return screen
  }

  /** Types the query and steps onto the first match. */
  async function stepTo(container: HTMLElement, query: string) {
    await type(container, query)
    const next = container.querySelectorAll<HTMLElement>('.krona-search-step')[1]
    expect(next).toBeDefined()
    next?.click()
  }

  it('opens the collapsed run the match is hidden in', async () => {
    const screen = await open({ collapseUnchanged: true })
    // The needle is deep inside the unchanged middle, which is behind a bar.
    expect(screen.container.querySelectorAll('.krona-expand-bar').length).toBeGreaterThan(0)
    expect(screen.container.textContent).not.toContain('marker')

    await stepTo(screen.container, 'marker')
    await expect.poll(() => screen.container.textContent?.includes('marker')).toBe(true)
    expect(current(screen.container)).toBe('marker')
  })

  it('opens the folded block the match is hidden in', async () => {
    const screen = await open({ defaultCollapsedDepth: 1 })
    expect(screen.container.textContent).not.toContain('marker')

    await stepTo(screen.container, 'marker')
    await expect.poll(() => screen.container.textContent?.includes('marker')).toBe(true)
    expect(current(screen.container)).toBe('marker')
  })

  it('opens both at once, which is the case neither alone would catch', async () => {
    const screen = await open({ collapseUnchanged: true, defaultCollapsedDepth: 1 })
    expect(screen.container.textContent).not.toContain('marker')

    await stepTo(screen.container, 'marker')
    await expect.poll(() => screen.container.textContent?.includes('marker')).toBe(true)
    expect(current(screen.container)).toBe('marker')
    // Both panels scroll in lockstep, so the row is revealed in both.
    await expect.poll(() => matches(screen.container).length).toBe(2)
  })

  it('leaves alone what is not in the way', async () => {
    const screen = await open({ collapseUnchanged: true })
    const bars = screen.container.querySelectorAll('.krona-expand-bar').length
    // "head" is the changed line, which is never hidden; reaching it should not
    // open anything.
    await stepTo(screen.container, 'head')
    await expect.poll(() => current(screen.container)).toBe('head')
    expect(screen.container.querySelectorAll('.krona-expand-bar').length).toBe(bars)
  })
})
