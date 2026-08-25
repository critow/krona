import { type RefObject, useEffect, useState } from 'react'

/**
 * Watches an element's own width and reports whether it is below `threshold`.
 *
 * The element's width, not the window's: a diff can sit in a sidebar on a wide
 * screen and be just as cramped as one on a phone, and a media query cannot tell
 * the difference. `threshold` of `0` switches the watching off entirely.
 *
 * The first render answers `false`, since nothing has been measured yet. A
 * narrow layout therefore appears one frame in, which is the cost of asking the
 * layout rather than guessing at it.
 */
export function useNarrow(ref: RefObject<HTMLElement | null>, threshold: number): boolean {
  const [narrow, setNarrow] = useState(false)

  useEffect(() => {
    const element = ref.current
    if (!element || threshold <= 0 || typeof ResizeObserver === 'undefined') {
      setNarrow(false)
      return
    }
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      // `borderBoxSize` where it exists; the rect is the fallback and agrees.
      const width = entry.borderBoxSize?.[0]?.inlineSize ?? entry.contentRect.width
      setNarrow(width > 0 && width < threshold)
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref, threshold])

  return narrow
}
