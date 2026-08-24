import { diffArrays } from 'diff'

/** A half-open character range inside a single line. */
export interface Span {
  readonly start: number
  readonly end: number
}

/** Word-level highlights for one `changed` row. */
export interface IntralineResult {
  /** Ranges removed from the left line. */
  readonly left: readonly Span[]
  /** Ranges added on the right line. */
  readonly right: readonly Span[]
  /**
   * True when the two lines differ too much (or are too long) for word-level
   * highlighting to help, and the whole line should be painted instead.
   */
  readonly wholeLine: boolean
}

/** Options for {@link intralineDiff}. */
export interface IntralineOptions {
  /**
   * Lines longer than this skip word-level diffing. Two very long lines are
   * both the least useful and the most expensive case. Default 2000.
   */
  readonly maxLineLength?: number
  /**
   * If more than this fraction of a line changes, the whole line is painted
   * instead of a confetti of small highlights. Default 0.5.
   */
  readonly maxChangedFraction?: number
  /** Milliseconds the word diff may take before giving up. Default 100. */
  readonly timeout?: number
}

const DEFAULT_MAX_LINE_LENGTH = 2000
const DEFAULT_MAX_CHANGED_FRACTION = 0.5
const DEFAULT_TIMEOUT = 100

const WHOLE_LINE: IntralineResult = { left: [], right: [], wholeLine: true }
const NOTHING: IntralineResult = { left: [], right: [], wholeLine: false }

type CharClass = 0 | 1 | 2

function classOf(code: number): CharClass {
  if (code === 32 || code === 9) return 0
  const isWord =
    (code >= 48 && code <= 57) ||
    (code >= 65 && code <= 90) ||
    (code >= 97 && code <= 122) ||
    code === 95 ||
    code === 45 ||
    code === 46 ||
    code > 127
  return isWord ? 1 : 2
}

/**
 * Splits a line into words, whitespace runs and single punctuation characters.
 * Punctuation stays separate so `"port": 80` and `"port": 443` highlight only
 * the number. Linear, no regular expressions.
 */
export function tokenizeWords(text: string): string[] {
  const out: string[] = []
  let i = 0
  while (i < text.length) {
    const kind = classOf(text.charCodeAt(i))
    if (kind === 2) {
      out.push(text[i] as string)
      i++
      continue
    }
    const start = i
    while (i < text.length && classOf(text.charCodeAt(i)) === kind) i++
    out.push(text.slice(start, i))
  }
  return out
}

function mergeSpans(spans: Span[]): Span[] {
  if (spans.length < 2) return spans
  const out: Span[] = [spans[0] as Span]
  for (let i = 1; i < spans.length; i++) {
    const span = spans[i] as Span
    const last = out[out.length - 1] as Span
    if (span.start <= last.end) out[out.length - 1] = { start: last.start, end: span.end }
    else out.push(span)
  }
  return out
}

/**
 * Word-level diff of two facing lines, as GitHub highlights them.
 *
 * @example
 * ```ts
 * const { left, right } = intralineDiff('port: 80', 'port: 443')
 * // left  -> [{ start: 6, end: 8 }]
 * // right -> [{ start: 6, end: 9 }]
 * ```
 */
export function intralineDiff(
  left: string,
  right: string,
  options?: IntralineOptions,
): IntralineResult {
  if (left === right) return NOTHING
  const maxLineLength = options?.maxLineLength ?? DEFAULT_MAX_LINE_LENGTH
  if (left.length > maxLineLength || right.length > maxLineLength) return WHOLE_LINE

  const leftWords = tokenizeWords(left)
  const rightWords = tokenizeWords(right)
  const parts = diffArrays<string>(leftWords, rightWords, {
    timeout: options?.timeout ?? DEFAULT_TIMEOUT,
  })
  if (parts === undefined) return WHOLE_LINE

  const leftSpans: Span[] = []
  const rightSpans: Span[] = []
  let leftAt = 0
  let rightAt = 0
  let leftChanged = 0
  let rightChanged = 0

  for (const part of parts) {
    const length = part.value.reduce((sum, word) => sum + word.length, 0)
    if (part.added) {
      if (length > 0) rightSpans.push({ start: rightAt, end: rightAt + length })
      rightChanged += length
      rightAt += length
    } else if (part.removed) {
      if (length > 0) leftSpans.push({ start: leftAt, end: leftAt + length })
      leftChanged += length
      leftAt += length
    } else {
      leftAt += length
      rightAt += length
    }
  }

  const fraction = Math.max(
    left.length === 0 ? 0 : leftChanged / left.length,
    right.length === 0 ? 0 : rightChanged / right.length,
  )
  if (fraction > (options?.maxChangedFraction ?? DEFAULT_MAX_CHANGED_FRACTION)) return WHOLE_LINE

  return { left: mergeSpans(leftSpans), right: mergeSpans(rightSpans), wholeLine: false }
}
