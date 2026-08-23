import { useCallback, useMemo, useRef } from 'react'

/**
 * Keeps several scroll containers vertically in lockstep.
 *
 * A diff renders one virtualizer per panel over the *same* aligned rows, all at
 * the same fixed row height, so the panels are identical in height and syncing
 * is an exact `scrollTop` copy rather than a ratio — no drift, no rounding.
 * Horizontal scrolling stays independent, because the two sides have different
 * line lengths and locking them would drag one panel out of view.
 */
export interface ScrollSync {
  /** Registers a scroll container. Returns a cleanup function. */
  register(element: HTMLElement | null): () => void
  /** Scrolls every registered container to the same offset. */
  scrollTo(top: number): void
}

export function useScrollSync(): ScrollSync {
  const elements = useRef(new Set<HTMLElement>())
  const syncing = useRef(false)

  const handleScroll = useCallback((event: Event) => {
    if (syncing.current) return
    const source = event.currentTarget as HTMLElement
    syncing.current = true
    for (const element of elements.current) {
      if (element !== source && element.scrollTop !== source.scrollTop) {
        element.scrollTop = source.scrollTop
      }
    }
    // Released on the next frame: the assignments above fire their own scroll
    // events, and re-entering here would ping-pong the panels.
    requestAnimationFrame(() => {
      syncing.current = false
    })
  }, [])

  const register = useCallback(
    (element: HTMLElement | null) => {
      if (!element) return () => undefined
      elements.current.add(element)
      element.addEventListener('scroll', handleScroll, { passive: true })
      return () => {
        element.removeEventListener('scroll', handleScroll)
        elements.current.delete(element)
      }
    },
    [handleScroll],
  )

  const scrollTo = useCallback((top: number) => {
    for (const element of elements.current) element.scrollTop = top
  }, [])

  return useMemo(() => ({ register, scrollTo }), [register, scrollTo])
}
