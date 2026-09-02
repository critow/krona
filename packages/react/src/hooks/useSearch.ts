import type { AlignedRow, DocumentModel, MatchIndex, SearchHit, Span } from '@kronajs/core'
import { findMatches, hitFrom, hitsInRowOrder, indexByLine } from '@kronajs/core'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { KronaLabels } from '../labels'

export type { MatchIndex, SearchHit }

/** What to search: one document, or the two of a diff read in row order. */
export type SearchTarget =
  | { readonly kind: 'single'; readonly model: DocumentModel }
  | {
      readonly kind: 'diff'
      readonly left: DocumentModel
      readonly right: DocumentModel
      readonly rows: readonly AlignedRow[]
    }

const NO_SPANS: readonly Span[] = []

/**
 * Search over what the reader is looking at.
 *
 * In a diff the hits are ordered by row rather than by document, so walking
 * them reads down the screen: a line removed and the line that replaced it are
 * neighbours, however far apart they sit in their own files.
 */
export function useSearch(
  target: SearchTarget,
  reveal: (hit: SearchHit) => void,
  labels: KronaLabels,
) {
  const [query, setQuery] = useState('')
  const [caseSensitive, setCaseSensitive] = useState(false)
  // Where the reader is, so next and previous mean something before anything
  // has been found. Kept in a ref: moving through matches must not re-run the
  // search that produced them.
  const at = useRef({ lineIndex: -1, column: -1 })
  const [index, setIndex] = useState(-1)

  const single = target.kind === 'single' ? target.model : null
  const left = target.kind === 'diff' ? target.left : null
  const right = target.kind === 'diff' ? target.right : null

  const options = useMemo(() => ({ caseSensitive }), [caseSensitive])

  const leftResult = useMemo(
    () => (left ? findMatches(left, query, options) : null),
    [left, query, options],
  )
  const rightResult = useMemo(
    () => (right ? findMatches(right, query, options) : null),
    [right, query, options],
  )
  const singleResult = useMemo(
    () => (single ? findMatches(single, query, options) : null),
    [single, query, options],
  )

  const leftByLine = useMemo(() => indexByLine(leftResult?.matches ?? []), [leftResult])
  const rightByLine = useMemo(() => indexByLine(rightResult?.matches ?? []), [rightResult])
  const singleByLine = useMemo(() => indexByLine(singleResult?.matches ?? []), [singleResult])

  const rows = target.kind === 'diff' ? target.rows : null

  const hits = useMemo<SearchHit[]>(() => {
    if (singleResult) {
      return singleResult.matches.map((match) => ({ ...match, side: 'single' as const }))
    }
    if (!rows) return []
    return hitsInRowOrder(rows, leftByLine, rightByLine)
  }, [singleResult, rows, leftByLine, rightByLine])

  const truncated = Boolean(
    singleResult?.truncated || leftResult?.truncated || rightResult?.truncated,
  )

  // A new query invalidates the position: the reader is looking for something
  // else now, and the next jump should start from where they are on screen.
  const lastHits = useRef(hits)
  if (lastHits.current !== hits) {
    lastHits.current = hits
    if (index !== -1) setIndex(-1)
  }

  const go = useCallback(
    (direction: 1 | -1) => {
      if (hits.length === 0) return
      // A functional update, because two clicks can land in one frame and the
      // second must still advance: reading the index from the closure would
      // make it repeat the first one's answer.
      setIndex((current) => {
        if (current !== -1) return (current + direction + hits.length) % hits.length
        // Nothing is current yet, so the first jump lands on the first hit
        // after wherever the reader already is.
        return hitFrom(hits, at.current, direction)
      })
    },
    [hits],
  )

  // Revealing is a side effect of standing somewhere, not of pressing a button:
  // that way it happens once per landing, however the index got there.
  useEffect(() => {
    if (index === -1) return
    const hit = hits[index]
    if (!hit) return
    at.current = { lineIndex: hit.lineIndex, column: hit.start }
    reveal(hit)
  }, [index, hits, reveal])

  const next = useCallback(() => go(1), [go])
  const previous = useCallback(() => go(-1), [go])

  const clear = useCallback(() => {
    setQuery('')
    setIndex(-1)
    at.current = { lineIndex: -1, column: -1 }
  }, [])

  const current = index === -1 ? null : ((hits[index] ?? null) as SearchHit | null)

  const state = useMemo(
    () => ({
      labels,
      query,
      setQuery,
      caseSensitive,
      setCaseSensitive,
      total: hits.length,
      truncated,
      position: index === -1 ? 0 : index + 1,
      current,
      next,
      previous,
      clear,
    }),
    [labels, query, caseSensitive, hits.length, truncated, index, current, next, previous, clear],
  )

  const matchesAt = useCallback(
    (lineIndex: number, side?: 'left' | 'right'): readonly Span[] => {
      if (query.length === 0) return NO_SPANS
      const byLine = side === 'left' ? leftByLine : side === 'right' ? rightByLine : singleByLine
      return byLine.get(lineIndex) ?? NO_SPANS
    },
    [query, leftByLine, rightByLine, singleByLine],
  )

  return { state, matchesAt, current }
}

/** State exposed by {@link useKronaSearch}. */
export type KronaSearchState = ReturnType<typeof useSearch>['state']
