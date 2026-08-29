import { Krona, useKronaViewer } from 'kronajs'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'

const SOURCE = [
  '{',
  '  "name": "krona",',
  '  "server": {',
  '    "host": "0.0.0.0"',
  '  },',
  '  "tail": 1',
  '}',
].join('\n')

/** Reports the document after every edit, so a test can assert on the text. */
function Harness({ editable = true }: { editable?: boolean }) {
  const [source, setSource] = useState(SOURCE)
  return (
    <Krona format="json">
      <Krona.Viewer source={SOURCE} editable={editable} onChange={setSource}>
        <Krona.Toolbar />
        <Krona.Gutter />
        <Krona.Lines />
      </Krona.Viewer>
      <pre data-testid="result">{source}</pre>
    </Krona>
  )
}

function resultOf(container: HTMLElement): string {
  return container.querySelector('[data-testid="result"]')?.textContent ?? ''
}

function valueButtons(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>('.krona-value')]
}

/** Row actions appear on hover, so a test has to hover the row like a reader. */
async function rowAction(container: HTMLElement, rowIndex: number, label: string) {
  const rows = container.querySelectorAll<HTMLElement>('.krona-lines .krona-row')
  const row = rows[rowIndex]
  expect(row, `no row ${rowIndex}`).toBeDefined()
  if (!row) return undefined
  await userEvent.hover(row)
  return row.querySelector<HTMLElement>(`[aria-label="${label}"]`) ?? undefined
}

async function openValue(container: HTMLElement, text: string) {
  const button = valueButtons(container).find((element) => element.textContent === text)
  expect(button, `no value button for ${text}`).toBeDefined()
  if (!button) return
  await userEvent.dblClick(button)
}

describe('editing in Krona.Viewer', () => {
  it('offers no editing controls unless asked, only the copy actions', async () => {
    const screen = await render(<Harness editable={false} />)
    await expect
      .poll(() => screen.container.querySelectorAll('.krona-row').length)
      .toBeGreaterThan(0)
    expect(valueButtons(screen.container)).toHaveLength(0)
    for (const label of ['Edit line', 'Edit block', 'Delete', 'Duplicate']) {
      expect(screen.container.querySelectorAll(`[aria-label="${label}"]`)).toHaveLength(0)
    }
    expect(screen.container.querySelectorAll('[aria-label="Copy"]').length).toBeGreaterThan(0)
  })

  it('copies an entry, and just the value, from a read-only document', async () => {
    // Reading the clipboard back needs a permission the test browser withholds,
    // so the assertion is on what the component hands it.
    const written: string[] = []
    const write = vi
      .spyOn(navigator.clipboard, 'writeText')
      .mockImplementation(async (text: string) => {
        written.push(text)
      })

    try {
      const screen = await render(<Harness editable={false} />)
      await expect
        .poll(() => screen.container.querySelectorAll('.krona-row').length)
        .toBeGreaterThan(0)

      const copyValue = await rowAction(screen.container, 1, 'Copy value')
      expect(copyValue).toBeDefined()
      if (!copyValue) return
      await userEvent.click(copyValue)
      await expect.poll(() => written).toEqual(['"krona"'])

      const copyEntry = await rowAction(screen.container, 2, 'Copy')
      expect(copyEntry).toBeDefined()
      if (!copyEntry) return
      await userEvent.click(copyEntry)
      await expect
        .poll(() => written[1])
        .toBe(['  "server": {', '    "host": "0.0.0.0"', '  },'].join('\n'))
    } finally {
      write.mockRestore()
    }
  })

  it('copies the path to a nested line', async () => {
    const written: string[] = []
    const write = vi
      .spyOn(navigator.clipboard, 'writeText')
      .mockImplementation(async (text: string) => {
        written.push(text)
      })

    try {
      const screen = await render(<Harness editable={false} />)
      await expect
        .poll(() => screen.container.querySelectorAll('.krona-row').length)
        .toBeGreaterThan(0)

      const copyPath = await rowAction(screen.container, 3, 'Copy path')
      expect(copyPath).toBeDefined()
      if (!copyPath) return
      await userEvent.click(copyPath)
      await expect.poll(() => written).toEqual(['server.host'])
    } finally {
      write.mockRestore()
    }
  })

  it('duplicates an entry and opens the copy for editing', async () => {
    const screen = await render(<Harness />)
    await expect.poll(() => valueButtons(screen.container).length).toBeGreaterThan(0)

    const duplicate = await rowAction(screen.container, 1, 'Duplicate')
    expect(duplicate).toBeDefined()
    if (!duplicate) return
    await userEvent.click(duplicate)

    await expect
      .poll(() => resultOf(screen.container))
      .toBe(
        [
          '{',
          '  "name": "krona",',
          '  "name": "krona",',
          '  "server": {',
          '    "host": "0.0.0.0"',
          '  },',
          '  "tail": 1',
          '}',
        ].join('\n'),
      )

    const area = screen.container.querySelector<HTMLTextAreaElement>('.krona-editor-area')
    expect(area).toBeDefined()
    expect(area?.value).toBe('  "name": "krona",')
  })

  it('edits one value in place and leaves the rest of the line alone', async () => {
    const screen = await render(<Harness />)
    await expect.poll(() => valueButtons(screen.container).length).toBeGreaterThan(0)

    await openValue(screen.container, '"0.0.0.0"')
    const input = screen.container.querySelector<HTMLInputElement>('.krona-editor-input')
    expect(input).toBeDefined()
    if (!input) return

    await userEvent.fill(input, '"127.0.0.1"')
    await userEvent.keyboard('{Enter}')

    await expect
      .poll(() => resultOf(screen.container))
      .toBe(SOURCE.replace('"0.0.0.0"', '"127.0.0.1"'))
  })

  it('leaves the document untouched when the editor is cancelled', async () => {
    const screen = await render(<Harness />)
    await expect.poll(() => valueButtons(screen.container).length).toBeGreaterThan(0)

    await openValue(screen.container, '1')
    await userEvent.keyboard('999{Escape}')

    await expect.poll(() => screen.container.querySelector('.krona-editor-input')).toBe(null)
    expect(resultOf(screen.container)).toBe(SOURCE)
  })

  it('removes a whole block, and the comma that would be left dangling', async () => {
    const screen = await render(<Harness />)
    await expect.poll(() => screen.container.querySelectorAll('.krona-row-actions').length).toBe(7)

    // The third row is `"server": {`, whose delete takes the block with it.
    const remove = await rowAction(screen.container, 2, 'Delete')
    expect(remove).toBeDefined()
    if (!remove) return
    await userEvent.click(remove)

    await expect
      .poll(() => resultOf(screen.container))
      .toBe(['{', '  "name": "krona",', '  "tail": 1', '}'].join('\n'))
  })

  it('undoes and redoes an edit from the toolbar', async () => {
    const screen = await render(<Harness />)
    await expect.poll(() => valueButtons(screen.container).length).toBeGreaterThan(0)

    await openValue(screen.container, '"krona"')
    const input = screen.container.querySelector<HTMLInputElement>('.krona-editor-input')
    if (!input) return
    await userEvent.fill(input, '"renamed"')
    await userEvent.keyboard('{Enter}')
    await expect.poll(() => resultOf(screen.container)).toContain('"renamed"')

    await screen.getByRole('button', { name: 'Undo' }).click()
    await expect.poll(() => resultOf(screen.container)).toBe(SOURCE)

    await screen.getByRole('button', { name: 'Redo' }).click()
    await expect.poll(() => resultOf(screen.container)).toContain('"renamed"')
  })

  it('edits a whole block as text', async () => {
    const screen = await render(<Harness />)
    await expect.poll(() => screen.container.querySelectorAll('.krona-row-actions').length).toBe(7)

    const editBlock = await rowAction(screen.container, 2, 'Edit block')
    expect(editBlock).toBeDefined()
    if (!editBlock) return
    await userEvent.click(editBlock)

    const area = screen.container.querySelector<HTMLTextAreaElement>('.krona-editor-area')
    expect(area).toBeDefined()
    if (!area) return
    expect(area.value).toBe(['  "server": {', '    "host": "0.0.0.0"', '  },'].join('\n'))

    await userEvent.fill(area, '  "server": null,')
    await userEvent.click(screen.container.querySelector('.krona-editor-save') as HTMLElement)

    await expect
      .poll(() => resultOf(screen.container))
      .toBe(['{', '  "name": "krona",', '  "server": null,', '  "tail": 1', '}'].join('\n'))
  })

  it('reshapes an edited block into the layout the file already uses', async () => {
    const screen = await render(<Harness />)
    await expect.poll(() => screen.container.querySelectorAll('.krona-row-actions').length).toBe(7)

    const editBlock = await rowAction(screen.container, 2, 'Edit block')
    expect(editBlock).toBeDefined()
    if (!editBlock) return
    await userEvent.click(editBlock)

    const area = screen.container.querySelector<HTMLTextAreaElement>('.krona-editor-area')
    expect(area).toBeDefined()
    if (!area) return
    await userEvent.fill(area, '  "server": {"host":"127.0.0.1","port":8080},')
    await userEvent.click(screen.container.querySelector('.krona-editor-save') as HTMLElement)

    await expect
      .poll(() => resultOf(screen.container))
      .toBe(
        [
          '{',
          '  "name": "krona",',
          '  "server": {',
          '    "host": "127.0.0.1",',
          '    "port": 8080',
          '  },',
          '  "tail": 1',
          '}',
        ].join('\n'),
      )
  })

  it('undoes an edit and its formatting in one step', async () => {
    const screen = await render(<Harness />)
    await expect.poll(() => screen.container.querySelectorAll('.krona-row-actions').length).toBe(7)

    const editBlock = await rowAction(screen.container, 2, 'Edit block')
    if (!editBlock) return
    await userEvent.click(editBlock)
    const area = screen.container.querySelector<HTMLTextAreaElement>('.krona-editor-area')
    if (!area) return
    await userEvent.fill(area, '  "server": {"host":"x"},')
    await userEvent.click(screen.container.querySelector('.krona-editor-save') as HTMLElement)
    await expect.poll(() => resultOf(screen.container)).toContain('"host": "x"')

    await screen.getByRole('button', { name: 'Undo' }).click()
    await expect.poll(() => resultOf(screen.container)).toBe(SOURCE)
  })

  it('lifts a hovered row over its neighbours, but not over the gutter', async () => {
    const screen = await render(<Harness editable={false} />)
    await expect
      .poll(() => screen.container.querySelectorAll('.krona-row--actionable').length)
      .toBeGreaterThan(0)

    const rows = screen.container.querySelectorAll<HTMLElement>('.krona-lines .krona-row')
    const row = rows[1]
    const gutter = screen.container.querySelector<HTMLElement>('.krona-gutter')
    expect(row).toBeDefined()
    expect(gutter).toBeDefined()
    if (!row || !gutter) return
    expect(getComputedStyle(row).zIndex).toBe('auto')

    await userEvent.hover(row)
    // Rows contain their layout, so each is its own stacking context and a
    // tooltip's z-index only ranks it inside its row; the row itself has to
    // rise. Only just, though: the gutter is sticky, and a row that outranked
    // it would slide over the line numbers when the panel scrolls sideways.
    await expect.poll(() => Number(getComputedStyle(row).zIndex)).toBeGreaterThan(0)
    expect(Number(getComputedStyle(row).zIndex)).toBeLessThan(
      Number(getComputedStyle(gutter).zIndex),
    )
  })

  it('keeps the tooltip text out of a control\u2019s accessible name', async () => {
    const screen = await render(<Harness />)
    await expect.poll(() => screen.container.querySelectorAll('.krona-row-actions').length).toBe(7)

    // Generated content joins the accessible name unless an explicit label wins.
    // A tooltip that leaks into it renames every control it decorates.
    const remove = await rowAction(screen.container, 1, 'Delete')
    expect(remove).toBeDefined()
    expect(remove?.getAttribute('data-tip')).toBe('Delete')
    await expect.element(screen.getByRole('button', { name: 'Delete', exact: true })).toBeVisible()
  })

  it('reports every change through onChange', async () => {
    const onChange = vi.fn()
    const screen = await render(
      <Krona format="json">
        <Krona.Viewer source={SOURCE} editable onChange={onChange} />
      </Krona>,
    )
    await expect.poll(() => valueButtons(screen.container).length).toBeGreaterThan(0)

    await openValue(screen.container, '1')
    const input = screen.container.querySelector<HTMLInputElement>('.krona-editor-input')
    if (!input) return
    await userEvent.fill(input, '2')
    await userEvent.keyboard('{Enter}')

    await expect.poll(() => onChange.mock.calls.length).toBe(1)
    expect(onChange.mock.calls[0]?.[0]).toBe(SOURCE.replace('"tail": 1', '"tail": 2'))
  })

  it('exposes the edited document through useKronaViewer', async () => {
    function Probe() {
      const { source, canUndo } = useKronaViewer()
      return <span data-testid="probe">{`${canUndo}:${source.length}`}</span>
    }
    const screen = await render(
      <Krona format="json">
        <Krona.Viewer source={SOURCE} editable>
          <Probe />
          <Krona.Gutter />
          <Krona.Lines />
        </Krona.Viewer>
      </Krona>,
    )
    await expect
      .poll(() => screen.container.querySelector('[data-testid="probe"]')?.textContent)
      .toBe(`false:${SOURCE.length}`)
  })
})
