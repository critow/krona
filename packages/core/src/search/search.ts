import type { DocumentModel } from '../model/types'

/** One occurrence of the query, as columns inside a single line. */
export interface SearchMatch {
  readonly lineIndex: number
  /** Line-relative column where the match starts. */
  readonly start: number
  /** Line-relative column just past the match. */
  readonly end: number
}

/** How to read the query. */
export interface SearchOptions {
  /** Match the query's own case. Default false. */
  caseSensitive?: boolean
  /**
   * Most matches to collect. Default 5000.
   *
   * A one-character query against a lockfile has hundreds of thousands of
   * occurrences, and nobody is going to walk them; the cap keeps the index a
   * fixed cost and lets the view say the count is a floor rather than lie.
   */
  limit?: number
}

/** What a search found, and whether it stopped early. */
export interface SearchResult {
  /** Matches in reading order: by line, then by column. */
  readonly matches: readonly SearchMatch[]
  /** True when {@link SearchOptions.limit} was reached and matching stopped. */
  readonly truncated: boolean
}

const DEFAULT_LIMIT = 5000
const EMPTY: SearchResult = { matches: [], truncated: false }

/**
 * True when lowercasing a string keeps every character in place.
 *
 * Almost always. A few characters change length when folded — Turkish `İ`
 * becomes two code units — and a match found in the folded text would then be
 * reported at a column the original line does not have. Rather than carry an
 * index map for a case that occurs in almost no configuration file, such a line
 * is matched with its own case, which can only ever find fewer matches, never
 * wrong ones.
 */
function foldsInPlace(text: string, folded: string): boolean {
  return text.length === folded.length
}

/**
 * Every occurrence of `query` in the document, as line-relative columns.
 *
 * Literal text, not a pattern: a regular expression from a text field is a
 * regular expression from a stranger, and the one thing a viewer must never do
 * is stop answering. Matching is a scan per line — no index is built, nothing
 * is cached — because the result is thrown away the moment the query changes.
 *
 * Overlapping occurrences are not reported twice: after a match the scan
 * continues past its end, so `aa` in `aaaa` is found at 0 and 2.
 *
 * @example
 * ```ts
 * const { matches } = findMatches(model, 'localhost')
 * // → [{ lineIndex: 12, start: 10, end: 19 }, …]
 * ```
 */
export function findMatches(
  model: DocumentModel,
  query: string,
  options: SearchOptions = {},
): SearchResult {
  if (query.length === 0) return EMPTY
  // A limit that is not a number would never stop the walk: `matches.length >=
  // NaN` is false however many there are.
  const asked = options.limit
  const limit = asked === undefined || Number.isNaN(asked) ? DEFAULT_LIMIT : asked
  if (limit <= 0) return EMPTY

  const caseSensitive = options.caseSensitive ?? false
  const needle = caseSensitive ? query : query.toLowerCase()
  const matches: SearchMatch[] = []

  for (let lineIndex = 0; lineIndex < model.lines.length; lineIndex++) {
    const text = model.lines[lineIndex]?.text ?? ''
    if (text.length < needle.length) continue
    let haystack = text
    if (!caseSensitive) {
      const folded = text.toLowerCase()
      haystack = foldsInPlace(text, folded) ? folded : text
    }
    let from = 0
    while (from <= haystack.length - needle.length) {
      const at = haystack.indexOf(needle, from)
      if (at === -1) break
      matches.push({ lineIndex, start: at, end: at + needle.length })
      if (matches.length >= limit) return { matches, truncated: true }
      from = at + needle.length
    }
  }

  return { matches, truncated: false }
}

/**
 * The match a reader lands on when jumping forward or backward from a position.
 *
 * Returns an index into `matches`, wrapping around the ends: a search that
 * stops at the last match is a search that makes you scroll back to the top.
 * `-1` when there is nothing to land on.
 */
export function matchAfter(
  matches: readonly SearchMatch[],
  lineIndex: number,
  column: number,
  direction: 1 | -1 = 1,
): number {
  if (matches.length === 0) return -1
  if (direction === 1) {
    for (let i = 0; i < matches.length; i++) {
      const match = matches[i] as SearchMatch
      if (match.lineIndex > lineIndex || (match.lineIndex === lineIndex && match.start > column)) {
        return i
      }
    }
    return 0
  }
  for (let i = matches.length - 1; i >= 0; i--) {
    const match = matches[i] as SearchMatch
    if (match.lineIndex < lineIndex || (match.lineIndex === lineIndex && match.start < column)) {
      return i
    }
  }
  return matches.length - 1
}
