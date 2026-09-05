import {
  blockSpanAt,
  type DocumentModel,
  type KronaLabels,
  valueSpansAt,
  visibleText,
} from '@kronajs/core'
import { el } from './dom'
import type { EditSession } from './editing'

/** What a row offers besides its text. */
export interface RowActionHost {
  readonly labels: () => KronaLabels
  /** Copy value, path and entry. Off where the host does not want them. */
  readonly showCopy: () => boolean
  /** Present when the host wants to hear which line was picked. */
  readonly selectLine?: (lineIndex: number, side?: 'left' | 'right') => void
  /** Present where the reader may edit: opens an editor, duplicates, removes. */
  readonly editing?: () => EditSession | undefined
}

const SVG = 'http://www.w3.org/2000/svg'

const COPY =
  'M5.5 5.5V3.2c0-.4.3-.7.7-.7h6.6c.4 0 .7.3.7.7v6.6c0 .4-.3.7-.7.7h-2.3M3.2 5.5h6.6c.4 0 .7.3.7.7v6.6c0 .4-.3.7-.7.7H3.2a.7.7 0 0 1-.7-.7V6.2c0-.4.3-.7.7-.7Z'
const TICK = 'M3 8.5 6.4 12 13 4.6'
// A chain of two links, which is what every anchor in every document reader
// looks like; the path is the copy-path icon's shape at a different angle.
const LINK =
  'M6.7 9.3a2.4 2.4 0 0 0 3.6.3l2.2-2.2a2.4 2.4 0 0 0-3.4-3.4L8 5.1M9.3 6.7a2.4 2.4 0 0 0-3.6-.3L3.5 8.6a2.4 2.4 0 0 0 3.4 3.4L8 10.9'
const PENCIL = 'M3 13h2.5l7-7a1.8 1.8 0 0 0-2.5-2.5l-7 7V13Z'
const BRACES =
  'M6 2.5H5A1.5 1.5 0 0 0 3.5 4v2.2c0 .7-.6 1.3-1.3 1.3.7 0 1.3.6 1.3 1.3V11A1.5 1.5 0 0 0 5 12.5h1M10 2.5h1A1.5 1.5 0 0 1 12.5 4v2.2c0 .7.6 1.3 1.3 1.3-.7 0-1.3.6-1.3 1.3V11a1.5 1.5 0 0 1-1.5 1.5h-1'
const TRASH = 'M2.5 4h11M6 4V2.6h4V4M4.2 4l.5 9.4h6.6L11.8 4M6.6 6.4v4.6M9.4 6.4v4.6'
const PLUS = 'M8 3.2v9.6M3.2 8h9.6'
const PATH =
  'M6.2 9.8a2.6 2.6 0 0 0 3.9.3l2.4-2.4a2.6 2.6 0 0 0-3.7-3.7l-1.4 1.4M9.8 6.2a2.6 2.6 0 0 0-3.9-.3L3.5 8.3a2.6 2.6 0 0 0 3.7 3.7l1.4-1.4'

function icon(path: string, filled = false): SVGSVGElement {
  const svg = document.createElementNS(SVG, 'svg')
  svg.setAttribute('class', 'krona-action-icon')
  svg.setAttribute('viewBox', '0 0 16 16')
  svg.setAttribute('width', '12')
  svg.setAttribute('height', '12')
  svg.setAttribute('fill', filled ? 'currentColor' : 'none')
  svg.setAttribute('stroke', filled ? 'none' : 'currentColor')
  svg.setAttribute('stroke-width', '1.4')
  svg.setAttribute('stroke-linecap', 'round')
  svg.setAttribute('stroke-linejoin', 'round')
  svg.setAttribute('aria-hidden', 'true')
  svg.setAttribute('focusable', 'false')
  const node = document.createElementNS(SVG, 'path')
  node.setAttribute('d', path)
  svg.append(node)
  return svg
}

/**
 * Copies text, reporting whether it worked.
 *
 * The Clipboard API needs a secure context and a permission, and refuses
 * outright in some embeddings; a copy button that silently claims success is
 * worse than one that stays quiet.
 */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

/**
 * The actions that appear on a row: a link to it, and what it is worth copying.
 *
 * Returns null when the row has nothing to offer, so an empty container never
 * reaches the page and no row becomes `actionable` for no reason.
 */
export function rowActions(
  host: RowActionHost,
  model: DocumentModel,
  lineIndex: number,
  side?: 'left' | 'right',
): HTMLElement | null {
  const labels = host.labels()
  const showCopy = host.showCopy()
  const values = showCopy ? valueSpansAt(model, lineIndex) : []
  const only = values.length === 1 ? values[0] : undefined
  const block = showCopy ? blockSpanAt(model, lineIndex) : undefined
  const path = showCopy ? model.pathAt(lineIndex) : undefined
  const session = host.editing?.()
  if (!host.selectLine && !only && !block && !path && !session) return null

  const actions = el('span', 'krona-row-actions')
  // The tooltip is a pseudo-element, which a screen reader never sees, and the
  // button's own name must not change under the pointer.
  const said = el('span', 'krona-sr-only')
  said.setAttribute('role', 'status')
  actions.append(said)

  const button = (name: string, tip: string, glyph: SVGSVGElement, run: () => void) => {
    const node = el('button', undefined, [glyph])
    node.type = 'button'
    node.setAttribute('aria-label', name)
    node.dataset.tip = tip
    node.addEventListener('click', run)
    return node
  }

  /** Swaps the icon for a tick, briefly, when the clipboard actually took it. */
  const copy = (node: HTMLButtonElement, tip: string, text: string, filled: boolean) => {
    void copyText(text).then((ok) => {
      if (!ok) return
      said.textContent = labels.copied
      node.className = 'krona-action--confirmed'
      node.dataset.tip = labels.copied
      node.replaceChildren(icon(TICK))
      setTimeout(() => {
        said.textContent = ''
        node.className = ''
        node.dataset.tip = tip
        node.replaceChildren(icon(COPY, filled))
      }, 1400)
    })
  }

  if (host.selectLine) {
    actions.append(
      button(labels.linkToLine, labels.linkToLine, icon(LINK), () =>
        host.selectLine?.(lineIndex, side),
      ),
    )
  }
  if (only) {
    const node = button(labels.copyValue, labels.copyValue, icon(COPY), () =>
      copy(node, labels.copyValue, model.source.slice(only.start, only.end), false),
    )
    actions.append(node)
  }
  if (path) {
    // Badged, like the rows: a tooltip cannot carry one, and a key holding a
    // bidi override would make the path read differently from what it is.
    const tip = `${labels.copyPath}: ${visibleText(path)}`
    const node = button(labels.copyPath, tip, icon(PATH), () => copy(node, tip, path, false))
    actions.append(node)
  }
  if (block) {
    const node = button(labels.copyEntry, labels.copyEntry, icon(COPY, true), () =>
      copy(node, labels.copyEntry, model.source.slice(block.start, block.end), true),
    )
    actions.append(node)
  }
  if (session) {
    actions.append(
      button(labels.editLine, labels.editLine, icon(PENCIL, true), () =>
        session.editLine(lineIndex),
      ),
    )
    if (model.foldAt(lineIndex)) {
      actions.append(
        button(labels.editBlock, labels.editBlock, icon(BRACES), () =>
          session.editBlock(lineIndex),
        ),
      )
    }
    actions.append(
      button(labels.duplicateEntry, labels.duplicateEntry, icon(PLUS), () =>
        session.duplicate(lineIndex),
      ),
    )
    const remove = button(labels.deleteEntry, labels.deleteEntry, icon(TRASH), () =>
      session.remove(lineIndex),
    )
    remove.className = 'krona-action--danger'
    actions.append(remove)
  }
  return actions
}
