import { Krona } from 'kronajs'
import { describe, expect, it } from 'vitest'
import { userEvent } from 'vitest/browser'
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

function rows(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>('.krona-lines > .krona-row[role="treeitem"]')]
}

function open() {
  return render(
    <Krona format="json" narrowWidth={0}>
      <Krona.Viewer source={DOC}>
        <Krona.Gutter />
        <Krona.Lines />
      </Krona.Viewer>
    </Krona>,
  )
}

describe('walking the document with the keyboard', () => {
  it('states the nesting the folding ranges describe', async () => {
    const screen = await open()
    await expect.poll(() => rows(screen.container).length).toBe(8)

    // The line that opens a block sits at its parent's level: a `{` is the
    // child, and the entries inside it are the grandchildren.
    expect(rows(screen.container).map((row) => row.getAttribute('aria-level'))).toEqual([
      '1',
      '2',
      '2',
      '3',
      '3',
      '3',
      '2',
      '2',
    ])

    const tree = screen.container.querySelector('.krona-lines')
    expect(tree?.getAttribute('role')).toBe('tree')
    // Only a line that opens a block claims to be expandable.
    expect(rows(screen.container).map((row) => row.getAttribute('aria-expanded'))).toEqual([
      'true',
      null,
      'true',
      null,
      null,
      null,
      null,
      null,
    ])
  })

  it('keeps exactly one row tabbable, so Tab enters the document once', async () => {
    const screen = await open()
    await expect.poll(() => rows(screen.container).length).toBe(8)
    const tabbable = () => rows(screen.container).filter((row) => row.tabIndex === 0)
    expect(tabbable()).toHaveLength(1)

    rows(screen.container)[0]?.focus()
    await userEvent.keyboard('{ArrowDown}')
    await expect.poll(() => tabbable()).toHaveLength(1)
    // And it is the row the reader is standing on.
    expect(tabbable()[0]).toBe(document.activeElement)
  })

  it('moves down and up a line at a time', async () => {
    const screen = await open()
    await expect.poll(() => rows(screen.container).length).toBe(8)
    rows(screen.container)[0]?.focus()

    await userEvent.keyboard('{ArrowDown}{ArrowDown}')
    await expect.poll(() => (document.activeElement as HTMLElement)?.dataset.index).toBe('2')

    await userEvent.keyboard('{ArrowUp}')
    await expect.poll(() => (document.activeElement as HTMLElement)?.dataset.index).toBe('1')
  })

  it('goes to the first and last line on Home and End', async () => {
    const screen = await open()
    await expect.poll(() => rows(screen.container).length).toBe(8)
    rows(screen.container)[0]?.focus()

    await userEvent.keyboard('{End}')
    await expect.poll(() => (document.activeElement as HTMLElement)?.dataset.index).toBe('7')

    await userEvent.keyboard('{Home}')
    await expect.poll(() => (document.activeElement as HTMLElement)?.dataset.index).toBe('0')
  })

  it('closes a block with Left and opens it again with Right', async () => {
    const screen = await open()
    await expect.poll(() => rows(screen.container).length).toBe(8)
    // The line that opens the server block.
    rows(screen.container)[2]?.focus()

    await userEvent.keyboard('{ArrowLeft}')
    await expect.poll(() => screen.container.textContent).not.toContain('localhost')
    expect(rows(screen.container)[2]?.getAttribute('aria-expanded')).toBe('false')

    await userEvent.keyboard('{ArrowRight}')
    await expect.poll(() => screen.container.textContent).toContain('localhost')
    expect(rows(screen.container)[2]?.getAttribute('aria-expanded')).toBe('true')
  })

  it('walks out to the enclosing block when the line does not open one', async () => {
    const screen = await open()
    await expect.poll(() => rows(screen.container).length).toBe(8)
    // `"host"`, three levels deep and opening nothing of its own.
    rows(screen.container)[3]?.focus()

    await userEvent.keyboard('{ArrowLeft}')
    await expect.poll(() => (document.activeElement as HTMLElement)?.dataset.index).toBe('2')
  })

  it('toggles the block under the cursor on Enter', async () => {
    const screen = await open()
    await expect.poll(() => rows(screen.container).length).toBe(8)
    rows(screen.container)[2]?.focus()

    await userEvent.keyboard('{Enter}')
    await expect.poll(() => screen.container.textContent).not.toContain('localhost')
  })
})
