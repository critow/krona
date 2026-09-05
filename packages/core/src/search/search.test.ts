import { describe, expect, it } from 'vitest'
import { parseDocument } from '../model/document'
import { findMatches, matchAfter } from './search'

const DOC = ['{', '  "host": "localhost",', '  "hosts": ["localhost", "LOCALHOST"]', '}'].join('\n')

const model = () => parseDocument(DOC, 'json')

describe('findMatches', () => {
  it('reports every occurrence as line-relative columns, in reading order', () => {
    const { matches, truncated } = findMatches(model(), 'localhost')
    expect(truncated).toBe(false)
    expect(matches).toEqual([
      { lineIndex: 1, start: 11, end: 20 },
      { lineIndex: 2, start: 13, end: 22 },
      { lineIndex: 2, start: 26, end: 35 },
    ])
    // The columns are the ones the line actually has.
    const line = DOC.split('\n')[2] as string
    expect(line.slice(26, 35)).toBe('LOCALHOST')
  })

  it('matches the query case only when asked to', () => {
    const sensitive = findMatches(model(), 'LOCALHOST', { caseSensitive: true })
    expect(sensitive.matches).toEqual([{ lineIndex: 2, start: 26, end: 35 }])
  })

  it('does not report overlapping occurrences twice', () => {
    const doc = parseDocument('aaaa', 'text')
    expect(findMatches(doc, 'aa').matches).toEqual([
      { lineIndex: 0, start: 0, end: 2 },
      { lineIndex: 0, start: 2, end: 4 },
    ])
  })

  it('stops at the limit and says so', () => {
    const doc = parseDocument('aaaaaaaa', 'text')
    const { matches, truncated } = findMatches(doc, 'a', { limit: 3 })
    expect(matches).toHaveLength(3)
    expect(truncated).toBe(true)
  })

  it('finds nothing for an empty query, rather than everything', () => {
    expect(findMatches(model(), '')).toEqual({ matches: [], truncated: false })
  })

  it('keeps columns honest on a line whose case does not fold in place', () => {
    // 'İ'.toLowerCase() is two code units, so a match found in the folded text
    // would be reported at a column the line does not have. Such a line falls
    // back to its own case: fewer matches, never misplaced ones.
    const doc = parseDocument('İstanbul: stanbul', 'text')
    const { matches } = findMatches(doc, 'stanbul')
    expect(matches).toEqual([
      { lineIndex: 0, start: 1, end: 8 },
      { lineIndex: 0, start: 10, end: 17 },
    ])
    const line = 'İstanbul: stanbul'
    for (const match of matches) expect(line.slice(match.start, match.end)).toBe('stanbul')
  })
})

describe('a limit that is not a number', () => {
  it('keeps the default cap instead of walking without one', () => {
    // `matches.length >= NaN` is false however many there are.
    const model = parseDocument('a'.repeat(6000), 'text')
    const result = findMatches(model, 'a', { limit: Number.NaN })
    expect(result.matches).toHaveLength(5000)
    expect(result.truncated).toBe(true)
  })
})

describe('matchAfter', () => {
  const matches = [
    { lineIndex: 1, start: 11, end: 20 },
    { lineIndex: 2, start: 13, end: 22 },
    { lineIndex: 2, start: 26, end: 35 },
  ]

  it('lands on the next match after a position', () => {
    expect(matchAfter(matches, 0, 0)).toBe(0)
    expect(matchAfter(matches, 1, 11)).toBe(1)
    expect(matchAfter(matches, 2, 13)).toBe(2)
  })

  it('wraps rather than stopping at the end', () => {
    expect(matchAfter(matches, 9, 0)).toBe(0)
    expect(matchAfter(matches, 0, 0, -1)).toBe(2)
  })

  it('walks backwards from a position', () => {
    expect(matchAfter(matches, 2, 26, -1)).toBe(1)
    expect(matchAfter(matches, 2, 13, -1)).toBe(0)
  })

  it('answers -1 when there is nothing to land on', () => {
    expect(matchAfter([], 0, 0)).toBe(-1)
  })
})
