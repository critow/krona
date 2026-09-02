import type { AlignedRow } from '../diff/align'
import type { Span } from '../diff/intraline'
import type { SearchMatch } from './search'

/** One occurrence, placed in the view rather than only in a document. */
export interface SearchHit extends SearchMatch {
  /** Which document it was found in. `'single'` outside a diff. */
  readonly side: 'single' | 'left' | 'right'
  /** Aligned row showing it, in a diff. */
  readonly row?: number
}

/** Matches of one document, indexed by the line they sit on. */
export type MatchIndex = ReadonlyMap<number, readonly Span[]>

const NO_SPANS: readonly Span[] = []

/**
 * Matches grouped by line, for a view that paints one row at a time.
 *
 * A row knows its line number and nothing else, so it needs to ask by line
 * rather than to search a list of every match in the document on every paint.
 */
export function indexByLine(matches: readonly SearchMatch[]): MatchIndex {
  const byLine = new Map<number, Span[]>()
  for (const match of matches) {
    const spans = byLine.get(match.lineIndex)
    if (spans) spans.push(match)
    else byLine.set(match.lineIndex, [match])
  }
  return byLine
}

/**
 * The hits of a diff, in the order they appear on screen.
 *
 * Row order rather than document order: the two versions interleave down the
 * page, so a line that was removed and the line that replaced it are
 * neighbours here however far apart they sit in their own files. Walking the
 * matches then reads downwards, which is the only order a reader can follow.
 *
 * The left side of a row comes first, because that is where the eye starts.
 */
export function hitsInRowOrder(
  rows: readonly AlignedRow[],
  left: MatchIndex,
  right: MatchIndex,
): SearchHit[] {
  const ordered: SearchHit[] = []
  for (let row = 0; row < rows.length; row++) {
    const aligned = rows[row]
    if (!aligned) continue
    if (aligned.left !== null) {
      for (const span of left.get(aligned.left) ?? NO_SPANS) {
        ordered.push({ lineIndex: aligned.left, ...span, side: 'left', row })
      }
    }
    if (aligned.right !== null) {
      for (const span of right.get(aligned.right) ?? NO_SPANS) {
        ordered.push({ lineIndex: aligned.right, ...span, side: 'right', row })
      }
    }
  }
  return ordered
}

/** Where a walk through the hits starts from: a line and a column on it. */
export interface HitPosition {
  readonly lineIndex: number
  readonly column: number
}

/**
 * Index of the first hit past a position, wrapping around the ends.
 *
 * This is what a search field does the first time it is asked to jump: the
 * reader is somewhere in the document already, and the next match is the next
 * one from *there*, not the first one in the file. Returns `-1` when there are
 * no hits at all.
 */
export function hitFrom(hits: readonly SearchHit[], from: HitPosition, direction: 1 | -1): number {
  if (hits.length === 0) return -1
  for (let i = 0; i < hits.length; i++) {
    const index = direction === 1 ? i : hits.length - 1 - i
    const hit = hits[index]
    if (!hit) continue
    const past =
      direction === 1
        ? hit.lineIndex > from.lineIndex ||
          (hit.lineIndex === from.lineIndex && hit.start > from.column)
        : hit.lineIndex < from.lineIndex ||
          (hit.lineIndex === from.lineIndex && hit.start < from.column)
    if (past) return index
  }
  // Nothing past the position, so the walk comes round to the far end.
  return direction === 1 ? 0 : hits.length - 1
}
