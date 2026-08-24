import type { Token, TokenType } from '../model/types'

/** Number of leading spaces/tabs on a line. Tabs count as one column. */
export function indentOf(text: string): number {
  let i = 0
  while (i < text.length) {
    const c = text.charCodeAt(i)
    if (c !== 32 && c !== 9) break
    i++
  }
  return i
}

/** True when the line has no non-whitespace characters. */
export function isBlank(text: string): boolean {
  return indentOf(text) === text.length
}

/**
 * Scans a quoted scalar starting at `start` and returns the index just past the
 * closing quote (or the end of the line for an unterminated one).
 * Handles backslash escapes when `escapes` is true.
 */
export function scanQuoted(text: string, start: number, escapes: boolean): number {
  const quote = text.charCodeAt(start)
  let i = start + 1
  while (i < text.length) {
    const c = text.charCodeAt(i)
    if (escapes && c === 92 /* \ */) {
      i += 2
      continue
    }
    i++
    if (c === quote) return i
  }
  return text.length
}

const BOOLEANS = new Set(['true', 'false', 'yes', 'no', 'on', 'off'])
const NULLS = new Set(['null', 'nil', 'none', '~', ''])

/**
 * Classifies a bare (unquoted) scalar for highlighting. Uses explicit character
 * checks rather than regular expressions so it cannot backtrack.
 */
export function classifyScalar(value: string): TokenType {
  const lower = value.toLowerCase()
  if (NULLS.has(lower)) return 'null'
  if (BOOLEANS.has(lower)) return 'boolean'
  return isNumeric(value) ? 'number' : 'string'
}

function isHexDigit(c: number): boolean {
  return (c >= 48 && c <= 57) || (c >= 97 && c <= 102) || (c >= 65 && c <= 70) || c === 95 /* _ */
}

/** Recognises integers, floats, hex/octal/binary literals and exponents. */
export function isNumeric(value: string): boolean {
  if (value.length === 0) return false
  let i = 0
  if (value.charCodeAt(i) === 43 || value.charCodeAt(i) === 45) i++
  if (i >= value.length) return false
  if (
    value.charCodeAt(i) === 48 &&
    i + 1 < value.length &&
    'xXoObB'.includes(value[i + 1] as string)
  ) {
    for (let j = i + 2; j < value.length; j++) {
      if (!isHexDigit(value.charCodeAt(j))) return false
    }
    return value.length > i + 2
  }
  let seenDigit = false
  let seenDot = false
  let seenExp = false
  for (; i < value.length; i++) {
    const c = value.charCodeAt(i)
    if (c >= 48 && c <= 57) {
      seenDigit = true
    } else if (c === 95 /* _ */) {
    } else if (c === 46 /* . */ && !seenDot && !seenExp) {
      seenDot = true
    } else if ((c === 101 || c === 69) && seenDigit && !seenExp) {
      seenExp = true
      const next = value.charCodeAt(i + 1)
      if (next === 43 || next === 45) i++
    } else {
      return false
    }
  }
  return seenDigit
}

/** Appends a token, skipping empty ranges. */
export function push(tokens: Token[], type: TokenType, start: number, end: number): void {
  if (end > start) tokens.push({ type, start, end })
}
