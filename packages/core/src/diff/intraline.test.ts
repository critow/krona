import { describe, expect, it } from 'vitest'
import { intralineDiff, tokenizeWords } from './intraline'

const slice = (text: string, spans: readonly { start: number; end: number }[]) =>
  spans.map((s) => text.slice(s.start, s.end))

describe('tokenizeWords', () => {
  it('keeps punctuation separate from words', () => {
    expect(tokenizeWords('"port": 80')).toEqual(['"', 'port', '"', ':', ' ', '80'])
  })

  it('keeps whitespace runs as their own token', () => {
    expect(tokenizeWords('a   b')).toEqual(['a', '   ', 'b'])
  })

  it('treats non-ASCII letters as word characters', () => {
    expect(tokenizeWords('ключ: значение')).toEqual(['ключ', ':', ' ', 'значение'])
  })

  it('reassembles into the original line', () => {
    const line = '  - name: "a-b.c", id: 42 # note'
    expect(tokenizeWords(line).join('')).toBe(line)
  })
})

describe('intralineDiff', () => {
  it('highlights only the part that changed', () => {
    const left = '  "port": 80,'
    const right = '  "port": 443,'
    const result = intralineDiff(left, right)
    expect(result.wholeLine).toBe(false)
    expect(slice(left, result.left)).toEqual(['80'])
    expect(slice(right, result.right)).toEqual(['443'])
  })

  it('highlights an inserted fragment on one side only', () => {
    const left = 'features: [a]'
    const right = 'features: [a, b]'
    const result = intralineDiff(left, right)
    expect(result.left).toEqual([])
    expect(slice(right, result.right).join('')).toBe(', b')
  })

  it('returns nothing for identical lines', () => {
    expect(intralineDiff('same', 'same')).toEqual({ left: [], right: [], wholeLine: false })
  })

  it('falls back to whole-line highlighting when almost everything changed', () => {
    expect(intralineDiff('aaaa bbbb', 'zzzz yyyy').wholeLine).toBe(true)
  })

  it('skips word diffing for very long lines', () => {
    const left = 'x'.repeat(3000)
    const right = `${'x'.repeat(2999)}y`
    expect(intralineDiff(left, right, { maxLineLength: 2000 }).wholeLine).toBe(true)
  })

  it('merges touching spans', () => {
    const left = 'a: 1, b: 2'
    const right = 'a: 9, b: 2'
    const result = intralineDiff(left, right)
    expect(result.left).toHaveLength(1)
  })

  it('produces spans that stay inside their line', () => {
    const left = '  key = "old value"  # trailing'
    const right = '  key = "new value"'
    const result = intralineDiff(left, right)
    for (const span of result.left) {
      expect(span.end).toBeLessThanOrEqual(left.length)
      expect(span.start).toBeGreaterThanOrEqual(0)
    }
    for (const span of result.right) {
      expect(span.end).toBeLessThanOrEqual(right.length)
    }
  })
})
