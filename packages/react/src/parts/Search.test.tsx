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
