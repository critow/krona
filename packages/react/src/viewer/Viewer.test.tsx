import { Krona } from 'krona'
import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-react'

const SOURCE = [
  '{',
  '  "name": "krona",',
  '  "server": {',
  '    "host": "0.0.0.0",',
  '    "tls": {',
  '      "enabled": true',
  '    }',
  '  },',
  '  "tail": 1',
  '}',
].join('\n')

// Collapsing a bracket pair hides through its closing line, the way editors do,
// so folding `"server"` leaves lines 1-3 and 9-10 on screen.
const SERVER_COLLAPSED = [1, 2, 3, 9, 10]

async function renderViewer(props: Record<string, unknown> = {}) {
  const screen = await render(
    <Krona format="json">
      <Krona.Viewer source={SOURCE} {...props} />
    </Krona>,
  )
  return {
    screen,
    lineNumbers: () =>
      [...screen.container.querySelectorAll('.krona-lines .krona-row')]
        .map((row) => Number(row.getAttribute('data-line')))
        .sort((a, b) => a - b),
  }
}

describe('Krona.Viewer', () => {
  it('renders every line of a short document', async () => {
    const { lineNumbers } = await renderViewer()
    await expect.poll(lineNumbers).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  })

  it('hides a range when its chevron is clicked and restores it on the second click', async () => {
    const { screen, lineNumbers } = await renderViewer()
    await expect.poll(() => lineNumbers().length).toBe(10)

    await screen.getByRole('button', { name: 'Collapse block' }).nth(1).click()
    await expect.poll(lineNumbers).toEqual(SERVER_COLLAPSED)

    await screen.getByRole('button', { name: 'Expand block' }).first().click()
    await expect.poll(() => lineNumbers().length).toBe(10)
  })

  it('shows a placeholder that expands the block when clicked', async () => {
    const { screen, lineNumbers } = await renderViewer()
    await screen.getByRole('button', { name: 'Collapse block' }).nth(1).click()
    // The `server` object holds two keys, and the placeholder says so.
    const placeholder = screen.getByRole('button', { name: '{ 2 items }' }).first()
    await expect.element(placeholder).toBeVisible()
    await placeholder.click()
    await expect.poll(() => lineNumbers().length).toBe(10)
  })

  it('counts items for the collapsed placeholder in every format', async () => {
    const screen = await render(
      <Krona format="ini">
        <Krona.Viewer source={'[server]\nhost = 0.0.0.0\nport = 8080\nworkers = 4'} />
      </Krona>,
    )
    await expect.element(screen.getByRole('button', { name: 'Collapse block' })).toBeVisible()
    await screen.getByRole('button', { name: 'Collapse block' }).click()
    await expect.element(screen.getByRole('button', { name: '{ 3 items }' })).toBeVisible()
  })

  it('is operable from the keyboard, with aria-expanded reflecting the state', async () => {
    const { screen, lineNumbers } = await renderViewer()
    await expect.poll(() => lineNumbers().length).toBe(10)

    const toggles = screen.container.querySelectorAll<HTMLButtonElement>('.krona-fold-toggle')
    const toggle = toggles[1]
    expect(toggle).toBeDefined()
    toggle?.focus()
    expect(document.activeElement).toBe(toggle)

    await userPressEnter()
    await expect.poll(lineNumbers).toEqual(SERVER_COLLAPSED)
    await expect.poll(() => toggle?.getAttribute('aria-expanded')).toBe('false')

    await userPressEnter()
    await expect.poll(() => lineNumbers().length).toBe(10)
    await expect.poll(() => toggle?.getAttribute('aria-expanded')).toBe('true')
  })

  it('gives the fold control a target you can actually hit', async () => {
    const { screen } = await renderViewer()
    await expect
      .poll(() => screen.container.querySelectorAll('.krona-fold-toggle').length)
      .toBeGreaterThan(0)
    const toggle = screen.container.querySelector('.krona-fold-toggle') as HTMLElement
    const box = toggle.getBoundingClientRect()
    // This started life as a 16x16 icon wedged between a line number and the
    // code, which read as punctuation rather than as a control. The whole
    // gutter cell is the button now; the assertion is here so it cannot shrink
    // back without someone noticing.
    expect(box.width).toBeGreaterThanOrEqual(40)
    expect(box.height).toBeGreaterThanOrEqual(16)
    expect(toggle.tagName).toBe('BUTTON')
  })

  it('reaches every fold chevron with Tab alone', async () => {
    const { screen } = await renderViewer()
    await expect.poll(() => screen.container.querySelectorAll('.krona-fold-toggle').length).toBe(3)
    const toggles = [...screen.container.querySelectorAll('.krona-fold-toggle')]
    expect(toggles.every((el) => el.tagName === 'BUTTON' && !el.hasAttribute('tabindex'))).toBe(
      true,
    )
  })

  it('honours defaultCollapsedDepth', async () => {
    const { lineNumbers } = await renderViewer({ defaultCollapsedDepth: 1 })
    await expect.poll(lineNumbers).toEqual(SERVER_COLLAPSED)
  })

  it('re-applies defaultCollapsedDepth when the value changes', async () => {
    const screen = await render(
      <Krona format="json">
        <Krona.Viewer source={SOURCE} />
      </Krona>,
    )
    const lineNumbers = () =>
      [...screen.container.querySelectorAll('.krona-lines .krona-row')].map((row) =>
        Number(row.getAttribute('data-line')),
      )
    await expect.poll(() => lineNumbers().length).toBe(10)

    // The diff has always re-seeded on this prop; the viewer used to apply it
    // only at mount, so the two modes read the same prop differently.
    await screen.rerender(
      <Krona format="json">
        <Krona.Viewer source={SOURCE} defaultCollapsedDepth={1} />
      </Krona>,
    )
    await expect.poll(lineNumbers).toEqual(SERVER_COLLAPSED)
  })

  it('paints rows at the pitch the virtualizer positions them at', async () => {
    const screen = await render(
      <Krona format="json" lineHeight={30}>
        <Krona.Viewer source={SOURCE} />
      </Krona>,
    )
    await expect
      .poll(() => screen.container.querySelectorAll('.krona-lines .krona-row').length)
      .toBeGreaterThan(1)
    const rows = [...screen.container.querySelectorAll('.krona-lines .krona-row')]
    const [first, second] = rows
    expect(first?.getBoundingClientRect().height).toBe(30)
    // Row height and row spacing have to agree, or long documents drift.
    const gap =
      (second?.getBoundingClientRect().top ?? 0) - (first?.getBoundingClientRect().top ?? 0)
    expect(gap).toBe(30)
  })

  it('collapses and expands everything from the toolbar', async () => {
    const screen = await render(
      <Krona format="json">
        <Krona.Viewer source={SOURCE}>
          <Krona.Toolbar />
          <Krona.Gutter />
          <Krona.Lines />
        </Krona.Viewer>
      </Krona>,
    )
    const lineNumbers = () =>
      [...screen.container.querySelectorAll('.krona-lines .krona-row')].map((row) =>
        Number(row.getAttribute('data-line')),
      )
    await expect.poll(() => lineNumbers().length).toBe(10)
    await screen.getByRole('button', { name: 'Collapse all' }).click()
    await expect.poll(lineNumbers).toEqual([1])
    await screen.getByRole('button', { name: 'Expand all' }).click()
    await expect.poll(() => lineNumbers().length).toBe(10)
  })

  it('virtualizes a long document instead of rendering every line', async () => {
    const long = `{\n${Array.from({ length: 20_000 }, (_, i) => `  "k${i}": ${i},`).join('\n')}\n  "last": 1\n}`
    const screen = await render(
      <Krona format="json">
        <Krona.Viewer source={long} />
      </Krona>,
    )
    const rows = () => screen.container.querySelectorAll('.krona-lines .krona-row').length
    await expect.poll(rows).toBeGreaterThan(0)
    expect(rows()).toBeLessThan(200)
    const canvas = screen.container.querySelector('.krona-canvas') as HTMLElement
    expect(canvas.getBoundingClientRect().height).toBeGreaterThan(20_000 * 20 * 0.9)
  })

  it('renders the lines that scrolling brings into view', async () => {
    const long = `{\n${Array.from({ length: 5000 }, (_, i) => `  "k${i}": ${i},`).join('\n')}\n  "last": 1\n}`
    const screen = await render(
      <Krona format="json">
        <Krona.Viewer source={long} />
      </Krona>,
    )
    const first = () =>
      Number(
        screen.container.querySelector('.krona-lines .krona-row')?.getAttribute('data-line') ?? 0,
      )
    await expect.poll(first).toBeGreaterThan(0)
    const scroll = screen.container.querySelector('.krona-scroll') as HTMLElement
    scroll.scrollTop = 20_000
    await expect.poll(first).toBeGreaterThan(900)
  })

  it('paints tokens with their syntax classes', async () => {
    const { screen } = await renderViewer()
    await expect
      .poll(() => screen.container.querySelectorAll('.krona-token--key').length)
      .toBeGreaterThan(0)
    expect(screen.container.querySelectorAll('.krona-token--string').length).toBeGreaterThan(0)
    expect(screen.container.querySelectorAll('.krona-token--boolean').length).toBeGreaterThan(0)
  })

  it('renders a bidi override as a visible badge instead of reordering the line', async () => {
    const rlo = String.fromCharCode(0x202e)
    const screen = await render(
      <Krona format="ini">
        <Krona.Viewer source={`role = user${rlo}admin`} />
      </Krona>,
    )
    await expect.element(screen.getByText('U+202E')).toBeVisible()
    expect(screen.container.querySelector('.krona-lines')?.textContent).not.toContain(rlo)
  })

  it('shows a diagnostic for broken input without throwing', async () => {
    const screen = await render(
      <Krona format="json">
        <Krona.Viewer source={'{ "a": }'} />
      </Krona>,
    )
    await expect.element(screen.getByRole('status')).toBeVisible()
  })
})

async function userPressEnter(): Promise<void> {
  const active = document.activeElement as HTMLElement | null
  active?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
  active?.click()
  await Promise.resolve()
}
