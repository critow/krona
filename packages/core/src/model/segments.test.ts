import { describe, expect, it } from 'vitest'
import '../formats/json'
import { parseDocument } from './document'
import { contentColumnsOf } from './lines'
import { buildSegments } from './segments'
import type { Token } from './types'

const token = (start: number, end: number, type: Token['type']): Token =>
  ({ start, end, type }) as Token

/** Segments must tile the line exactly: no gaps, no overlaps, nothing lost. */
function tiles(text: string, segments: readonly { start: number; end: number }[]): boolean {
  let at = 0
  for (const segment of segments) {
    if (segment.start !== at || segment.end <= segment.start) return false
    at = segment.end
  }
  return at === text.length
}

describe('buildSegments', () => {
  it('has nothing to say about an empty line', () => {
    expect(buildSegments('', [], undefined, false)).toEqual([])
  })

  it('carries the token type of the run it falls in', () => {
    const text = '"port": 8080'
    const segments = buildSegments(
      text,
      [token(0, 6, 'key'), token(8, 12, 'number')],
      undefined,
      false,
    )
    expect(tiles(text, segments)).toBe(true)
    expect(segments.map((s) => s.token)).toEqual(['key', undefined, 'number'])
  })

  it('cuts a token where a word-level highlight starts and ends', () => {
    const text = 'port 8080'
    // The highlight covers only half of the number token.
    const segments = buildSegments(text, [token(5, 9, 'number')], [{ start: 5, end: 7 }], false)
    expect(tiles(text, segments)).toBe(true)
    const changed = segments.filter((s) => s.changed)
    expect(changed.map((s) => [s.start, s.end])).toEqual([[5, 7]])
    // Both halves are still the same token.
    expect(segments.filter((s) => s.start >= 5).every((s) => s.token === 'number')).toBe(true)
  })

  it('marks the whole line when the line itself is the change', () => {
    const text = 'gone: true'
    const segments = buildSegments(text, [token(0, 4, 'key')], undefined, true)
    expect(segments.every((s) => s.changed)).toBe(true)
  })

  it('tells the match the reader is standing on from the others', () => {
    const text = 'host host'
    const matches = [
      { start: 0, end: 4 },
      { start: 5, end: 9 },
    ]
    const segments = buildSegments(text, [], undefined, false, matches, matches[1])
    expect(tiles(text, segments)).toBe(true)
    expect(segments.map((s) => s.match)).toEqual(['match', undefined, 'current'])
  })

  it('cuts a dangerous character out on its own', () => {
    // A zero-width space, which must never reach the page as itself.
    const text = `a​b`
    const segments = buildSegments(text, [], undefined, false)
    expect(tiles(text, segments)).toBe(true)
    const unsafe = segments.filter((s) => s.unsafe)
    expect(unsafe).toHaveLength(1)
    expect(unsafe[0]?.end).toBe((unsafe[0]?.start ?? 0) + 1)
  })

  it('tiles the line when all three overlays land at once', () => {
    const text = '"host": "0.0.0.0"'
    const segments = buildSegments(
      text,
      [token(0, 6, 'key'), token(8, 17, 'string')],
      [{ start: 9, end: 12 }],
      false,
      [{ start: 1, end: 5 }],
      { start: 1, end: 5 },
    )
    expect(tiles(text, segments)).toBe(true)
    expect(segments.some((s) => s.match === 'current')).toBe(true)
    expect(segments.some((s) => s.changed)).toBe(true)
    expect(segments.some((s) => s.token === 'string')).toBe(true)
  })
})

describe('contentColumnsOf', () => {
  it('reserves the widest line across every document it is given', () => {
    const model = (text: string) => parseDocument(text, 'json')
    expect(contentColumnsOf(model('{}'), model('{"a": 1234567}'))).toBe(14)
  })

  it('ignores a document that is not there', () => {
    expect(contentColumnsOf(undefined, parseDocument('ab', 'json'))).toBe(2)
    expect(contentColumnsOf(undefined)).toBe(0)
  })
})
