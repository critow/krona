import type { Span } from '../diff/intraline'
import type { Token } from './types'
import { scanUnsafeCharacters, type UnsafeSpan } from './unicode'

/** A run of characters that share the same styling. */
export interface Segment {
  readonly start: number
  readonly end: number
  /** Token class, when the segment falls inside one. */
  readonly token?: Token['type']
  /** True when the segment is inside a word-level diff highlight. */
  readonly changed: boolean
  /** Set when the segment is inside a search match, and whether it is the one
   *  the reader is standing on. */
  readonly match?: 'match' | 'current'
  /** Set when the segment is a single character that must not be rendered raw. */
  readonly unsafe?: UnsafeSpan
}

function addBoundary(into: Set<number>, value: number, limit: number): void {
  if (value > 0 && value < limit) into.add(value)
}

/**
 * Splits a line into the smallest runs that are uniform across all three
 * overlays: syntax tokens, word-level diff highlights and dangerous characters.
 *
 * Doing the merge here means the renderer only ever emits plain text nodes —
 * there is no place where document content could become markup.
 */
export function buildSegments(
  text: string,
  tokens: readonly Token[],
  intraline: readonly Span[] | undefined,
  wholeLineChanged: boolean,
  matches?: readonly Span[],
  current?: Span,
): Segment[] {
  if (text.length === 0) return []

  const unsafe = scanUnsafeCharacters(text)
  const boundaries = new Set<number>()
  for (const token of tokens) {
    addBoundary(boundaries, token.start, text.length)
    addBoundary(boundaries, token.end, text.length)
  }
  if (intraline) {
    for (const span of intraline) {
      addBoundary(boundaries, span.start, text.length)
      addBoundary(boundaries, span.end, text.length)
    }
  }
  for (const span of unsafe) {
    addBoundary(boundaries, span.start, text.length)
    addBoundary(boundaries, span.end, text.length)
  }
  if (matches) {
    for (const span of matches) {
      addBoundary(boundaries, span.start, text.length)
      addBoundary(boundaries, span.end, text.length)
    }
  }

  const cuts = [0, ...[...boundaries].sort((a, b) => a - b), text.length]
  const segments: Segment[] = []
  let tokenIndex = 0
  let spanIndex = 0
  let unsafeIndex = 0
  let matchIndex = 0

  for (let i = 0; i < cuts.length - 1; i++) {
    const start = cuts[i] as number
    const end = cuts[i + 1] as number
    if (end <= start) continue

    while (tokenIndex < tokens.length && (tokens[tokenIndex] as Token).end <= start) tokenIndex++
    const token = tokens[tokenIndex]
    const tokenType = token && token.start <= start && token.end >= end ? token.type : undefined

    let changed = wholeLineChanged
    if (!changed && intraline) {
      while (spanIndex < intraline.length && (intraline[spanIndex] as Span).end <= start) {
        spanIndex++
      }
      const span = intraline[spanIndex]
      changed = span !== undefined && span.start <= start && span.end >= end
    }

    while (unsafeIndex < unsafe.length && (unsafe[unsafeIndex] as UnsafeSpan).end <= start) {
      unsafeIndex++
    }
    const dangerous = unsafe[unsafeIndex]
    const isUnsafe = dangerous !== undefined && dangerous.start === start && dangerous.end === end

    let match: Segment['match']
    if (matches) {
      while (matchIndex < matches.length && (matches[matchIndex] as Span).end <= start) matchIndex++
      const span = matches[matchIndex]
      if (span !== undefined && span.start <= start && span.end >= end) {
        // The current match is one of the matches, told apart by its columns:
        // the reader has to see which of several on a line they are on.
        match =
          current && current.start === span.start && current.end === span.end ? 'current' : 'match'
      }
    }

    segments.push({
      start,
      end,
      ...(tokenType ? { token: tokenType } : {}),
      changed,
      ...(match ? { match } : {}),
      ...(isUnsafe ? { unsafe: dangerous } : {}),
    })
  }

  return segments
}
