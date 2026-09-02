import { Krona } from 'kronajs'
import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-react'

const DOC = [
  '{',
  '  "name": "krona",',
  '  "server": {',
  '    "host": "localhost",',
  '    "port": 8080',
  '  },',
  '  "tail": 1',
  '}',
].join('\n')

function open(props: Record<string, unknown> = {}) {
  return render(
    <Krona format="json" narrowWidth={0}>
      <Krona.Viewer source={DOC} {...props}>
        <Krona.Gutter />
        <Krona.Lines />
      </Krona.Viewer>
    </Krona>,
  )
}

const selected = (container: HTMLElement) =>
  [...container.querySelectorAll('.krona-lines .krona-row--selected')].map(
    (row) => (row as HTMLElement).dataset.line,
  )

describe('linking to a line', () => {
  it('opens what hides the line and marks it, on the first render', async () => {
    // The block holding line 4 is folded on load, which is the case a link
    // arriving from somewhere else has to survive.
    const screen = await open({ defaultCollapsedDepth: 1, selectedLine: 4 })

    await expect.poll(() => screen.container.textContent).toContain('localhost')
    await expect.poll(() => selected(screen.container)).toEqual(['4'])
  })

  it('marks the line in the gutter as well, so the mark runs the whole row', async () => {
    const screen = await open({ selectedLine: 2 })
    await expect
      .poll(() => screen.container.querySelectorAll('.krona-row--selected').length)
      // One in the gutter column, one in the lines column.
      .toBe(2)
  })

  it('marks nothing without a line, and nothing for zero', async () => {
    const screen = await open()
    await expect
      .poll(() => screen.container.querySelectorAll('.krona-row').length)
      .toBeGreaterThan(0)
    expect(selected(screen.container)).toEqual([])

    const zero = await open({ selectedLine: 0 })
    await expect.poll(() => zero.container.querySelectorAll('.krona-row').length).toBeGreaterThan(0)
    expect(selected(zero.container)).toEqual([])
  })

  it('reports the line as the gutter numbers it, counting from one', async () => {
    const picked: number[] = []
    const screen = await open({ onSelectLine: (line: number) => picked.push(line) })
    await expect
      .poll(() => screen.container.querySelectorAll('.krona-row').length)
      .toBeGreaterThan(0)

    const row = screen.container.querySelector('[data-line="3"]')
    const link = row?.querySelector<HTMLElement>('[aria-label="Link to this line"]')
    expect(link).toBeDefined()
    link?.click()

    // The third line, not the index of it — this is the number a link carries.
    await expect.poll(() => picked).toEqual([3])
  })

  it('offers no link action where nobody is listening for one', async () => {
    const screen = await open()
    await expect
      .poll(() => screen.container.querySelectorAll('.krona-row').length)
      .toBeGreaterThan(0)
    expect(screen.container.querySelector('[aria-label="Link to this line"]')).toBe(null)
  })
})
