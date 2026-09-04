import { Krona } from 'kronajs'
import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-react'

const BEFORE = [
  '{',
  '  "name": "krona",',
  '  "server": {',
  '    "host": "localhost",',
  '    "port": 8080',
  '  },',
  '  "tail": 1',
  '}',
].join('\n')

const AFTER = BEFORE.replace('8080', '9090')

function open(props: Record<string, unknown> = {}, left = BEFORE, right = AFTER) {
  return render(
    <Krona format="json" narrowWidth={0}>
      <Krona.Diff left={left} right={right} {...props}>
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
}

/** The lines marked as selected, per panel, by the number the gutter shows. */
const selected = (container: HTMLElement, side: 'left' | 'right') =>
  [...container.querySelectorAll(`.krona-panel--${side} .krona-lines .krona-row--selected`)].map(
    (row) => (row as HTMLElement).dataset.line,
  )

const rows = (container: HTMLElement) =>
  container.querySelectorAll('.krona-panel--left .krona-lines .krona-row').length

describe('linking to a line in a diff', () => {
  it('marks the comparison, not one side of it', async () => {
    // Line 5 of the current version is the changed one; the row it sits on
    // shows line 5 of the previous version too.
    const screen = await open({ selectedLine: 5 })
    await expect.poll(() => rows(screen.container)).toBeGreaterThan(0)

    expect(selected(screen.container, 'right')).toEqual(['5'])
    // The other panel marks its own line of the same row, unasked. That is the
    // point of resolving the link to a row: both versions come to rest on one
    // comparison.
    expect(selected(screen.container, 'left')).toEqual(['5'])
  })

  it('counts the line in the version it was told to', async () => {
    // A line the two versions do not share: `"b"` exists only on the right, so
    // left line 3 and right line 3 are different rows.
    const left = '{\n  "a": 1,\n  "c": 3\n}'
    const right = '{\n  "a": 1,\n  "b": 2,\n  "c": 3\n}'

    const onLeft = await open({ selectedLine: 3, selectedSide: 'left' }, left, right)
    await expect.poll(() => rows(onLeft.container)).toBeGreaterThan(0)
    expect(selected(onLeft.container, 'left')).toEqual(['3'])
    // Left line 3 is `"c": 3`, which the right version numbers 4.
    expect(selected(onLeft.container, 'right')).toEqual(['4'])

    const onRight = await open({ selectedLine: 3, selectedSide: 'right' }, left, right)
    await expect.poll(() => rows(onRight.container)).toBeGreaterThan(0)
    // Right line 3 is `"b": 2`, which the left version does not have at all.
    expect(selected(onRight.container, 'right')).toEqual(['3'])
    expect(selected(onRight.container, 'left')).toEqual([])
  })

  it('defaults to the current version, which is what a diff is read for', async () => {
    const left = '{\n  "a": 1,\n  "c": 3\n}'
    const right = '{\n  "a": 1,\n  "b": 2,\n  "c": 3\n}'
    const screen = await open({ selectedLine: 3 }, left, right)
    await expect.poll(() => rows(screen.container)).toBeGreaterThan(0)
    expect(selected(screen.container, 'right')).toEqual(['3'])
  })

  it('opens a folded block to reach the row, on the first render', async () => {
    const screen = await open({ defaultCollapsedDepth: 1, selectedLine: 5 })
    await expect.poll(() => screen.container.textContent).toContain('9090')
    await expect.poll(() => selected(screen.container, 'right')).toEqual(['5'])
  })

  it('opens a collapsed run of unchanged rows to reach the row', async () => {
    const filler = Array.from({ length: 40 }, (_, i) => `  "same${i}": ${i},`).join('\n')
    const left = `{\n  "head": 1,\n${filler}\n  "tail": 1\n}`
    const right = `{\n  "head": 2,\n${filler}\n  "tail": 1\n}`
    // The needle is deep in the unchanged middle, which loads hidden.
    const screen = await open({ collapseUnchanged: true, selectedLine: 22 }, left, right)

    await expect.poll(() => screen.container.textContent).toContain('same19')
    await expect.poll(() => selected(screen.container, 'right')).toEqual(['22'])
  })

  it('marks nothing for a line neither version has', async () => {
    const screen = await open({ selectedLine: 99 })
    await expect.poll(() => rows(screen.container)).toBeGreaterThan(0)
    expect(selected(screen.container, 'left')).toEqual([])
    expect(selected(screen.container, 'right')).toEqual([])
  })

  it('marks nothing without a line, and nothing for zero', async () => {
    const none = await open()
    await expect.poll(() => rows(none.container)).toBeGreaterThan(0)
    expect(selected(none.container, 'right')).toEqual([])

    const zero = await open({ selectedLine: 0 })
    await expect.poll(() => rows(zero.container)).toBeGreaterThan(0)
    expect(selected(zero.container, 'right')).toEqual([])
  })

  it('reports the line and the version it belongs to', async () => {
    const picked: [number, string][] = []
    const screen = await open({
      onSelectLine: (line: number, side: string) => picked.push([line, side]),
    })
    await expect.poll(() => rows(screen.container)).toBeGreaterThan(0)

    const row = screen.container.querySelector('.krona-panel--left [data-line="3"]')
    row?.querySelector<HTMLElement>('[aria-label="Link to this line"]')?.click()
    await expect.poll(() => picked).toEqual([[3, 'left']])

    const right = screen.container.querySelector('.krona-panel--right [data-line="3"]')
    right?.querySelector<HTMLElement>('[aria-label="Link to this line"]')?.click()
    await expect
      .poll(() => picked)
      .toEqual([
        [3, 'left'],
        [3, 'right'],
      ])
  })

  it('offers no link action where nobody is listening for one', async () => {
    const screen = await open()
    await expect.poll(() => rows(screen.container)).toBeGreaterThan(0)
    expect(screen.container.querySelector('[aria-label="Link to this line"]')).toBe(null)
  })
})
