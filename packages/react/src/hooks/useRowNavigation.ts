import { type KeyboardEvent, useCallback, useEffect, useRef, useState } from 'react'
import type { LineSource } from '../context/lineSource'
import { levelAt } from '../render/levels'

/**
 * Arrow-key movement over the rows, with one of them tabbable.
 *
 * A document is a tree, and a tree is walked with the arrow keys — Tab through
 * every line of a lockfile is not navigation. Only the current row carries
 * `tabIndex={0}`, so Tab enters the document once and leaves it once, which is
 * the roving-tabindex pattern every tree widget uses.
 *
 * Rows are virtualized, so the row being moved to may not exist in the DOM
 * yet. Moving therefore sets the index and asks the virtualizer to bring it in;
 * an effect gives it focus once it has been rendered.
 */
export function useRowNavigation(source: LineSource) {
  const { rows, virtualItems, virtualizer } = source
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [active, setActive] = useState(0)
  // Focus is only moved for a reader who is already inside the document.
  // Without this the first render of a page would steal the caret.
  const holdsFocus = useRef(false)

  const navigable = useCallback(
    (index: number) => {
      const row = rows[index]
      // Spacers are the blank half of a changed pair — there is no line there
      // to stand on. An expand bar is a control, so it is a stop.
      return Boolean(row && (row.lineIndex !== null || row.expandRegion !== undefined))
    },
    [rows],
  )

  const step = useCallback(
    (from: number, direction: 1 | -1) => {
      for (let i = from + direction; i >= 0 && i < rows.length; i += direction) {
        if (navigable(i)) return i
      }
      return from
    },
    [rows.length, navigable],
  )

  const edge = useCallback(
    (direction: 1 | -1) => {
      const from = direction === 1 ? -1 : rows.length
      return step(from, direction)
    },
    [rows.length, step],
  )

  const go = useCallback(
    (index: number) => {
      if (index === active) return
      setActive(index)
      virtualizer.scrollToIndex(index)
    },
    [active, virtualizer],
  )

  /** The row that encloses this one: the nearest row above it a level up. */
  const parentOf = useCallback(
    (index: number) => {
      const row = rows[index]
      if (!row || row.lineIndex === null) return index
      const model = row.model ?? source.model
      const level = levelAt(model, row.lineIndex)
      if (level <= 1) return index
      for (let i = index - 1; i >= 0; i--) {
        const above = rows[i]
        if (!above || above.lineIndex === null) continue
        const aboveModel = above.model ?? source.model
        if (levelAt(aboveModel, above.lineIndex) < level) return i
      }
      return index
    },
    [rows, source.model],
  )

  const foldOf = useCallback(
    (index: number) => {
      const row = rows[index]
      if (!row || row.lineIndex === null) return undefined
      const range = source.foldAt(row.lineIndex, row.side)
      if (!range) return undefined
      return { range, side: row.side, folded: source.isFolded(range.startLine, row.side) }
    },
    [rows, source],
  )

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement
      // An editor open on a row owns its own arrow keys, and so does any field
      // a layout put inside the document.
      if (target.closest('input, textarea, select, [contenteditable="true"]')) return

      const fold = foldOf(active)
      switch (event.key) {
        case 'ArrowDown':
          go(step(active, 1))
          break
        case 'ArrowUp':
          go(step(active, -1))
          break
        case 'Home':
          go(edge(1))
          break
        case 'End':
          go(edge(-1))
          break
        case 'ArrowRight':
          // Open what is closed, otherwise walk into it — the same key doing
          // both is what makes a tree feel like a tree.
          if (fold?.folded) source.toggleFold(fold.range.startLine, fold.side)
          else go(step(active, 1))
          break
        case 'ArrowLeft':
          if (fold && !fold.folded) source.toggleFold(fold.range.startLine, fold.side)
          else go(parentOf(active))
          break
        case 'Enter':
        case ' ':
          // Only when the row itself has focus: a copy button inside it must
          // keep its own Enter.
          if (!target.classList.contains('krona-row')) return
          if (!fold) return
          source.toggleFold(fold.range.startLine, fold.side)
          break
        default:
          return
      }
      // Reached only for a key that was handled, so the page does not scroll
      // under a reader who is stepping through lines.
      event.preventDefault()
    },
    [active, edge, foldOf, go, parentOf, source, step],
  )

  // Whether the row being moved to exists in the DOM yet. Moving asks the
  // virtualizer to bring it in; this flips once it has, which is the moment
  // there is something to focus.
  const rendered = virtualItems.some((item) => item.index === active)

  useEffect(() => {
    if (!holdsFocus.current || !rendered) return
    const row = containerRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)
    row?.focus()
  }, [active, rendered])

  // The index can outlive the rows it pointed into — a fold closes, a document
  // is replaced — and a tree with no tabbable item cannot be entered at all.
  useEffect(() => {
    if (rows.length > 0 && !navigable(active)) setActive(edge(1))
  }, [rows.length, navigable, active, edge])

  return {
    containerRef,
    active,
    onKeyDown,
    onFocus: useCallback((event: React.FocusEvent<HTMLDivElement>) => {
      holdsFocus.current = true
      // Tabbing onto a row, or clicking one, makes it the row the arrows move
      // from. Focus landing on something inside a row leaves the index alone.
      const index = (event.target as HTMLElement).dataset?.index
      if (index !== undefined) setActive(Number(index))
    }, []),
    onBlur: useCallback((event: React.FocusEvent<HTMLDivElement>) => {
      if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
      holdsFocus.current = false
    }, []),
  }
}
