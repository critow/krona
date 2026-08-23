import { describe, expect, it } from 'vitest'
import { parseDocument } from '../model/document'
import '../index'

const doc = (source: string) => parseDocument(source, 'toml')

describe('toml provider', () => {
  it('folds tables and nests them by dotted path', () => {
    const model = doc(['[a]', 'x = 1', '', '[a.b]', 'y = 2', '', '[c]', 'z = 3'].join('\n'))
    expect(model.foldingRanges).toEqual([
      { startLine: 0, endLine: 4, level: 0, kind: 'section', summary: '[…]' },
      { startLine: 3, endLine: 4, level: 1, kind: 'section', summary: '[…]' },
      { startLine: 6, endLine: 7, level: 0, kind: 'section', summary: '[…]' },
    ])
  })

  it('keeps sibling arrays of tables as siblings, not nested', () => {
    const model = doc(['[[bin]]', 'name = "a"', '', '[[bin]]', 'name = "b"'].join('\n'))
    expect(model.foldingRanges.map((r) => [r.startLine, r.endLine, r.level])).toEqual([
      [0, 1, 0],
      [3, 4, 0],
    ])
  })

  it('trims trailing blank lines out of a section range', () => {
    const model = doc(['[a]', 'x = 1', '', '', '[b]', 'y = 2'].join('\n'))
    expect(model.foldingRanges[0]).toMatchObject({ startLine: 0, endLine: 1 })
  })

  it('folds a multi-line basic string as one scalar range', () => {
    const model = doc(['text = """', 'one', 'two', '"""', 'after = 1'].join('\n'))
    expect(model.foldingRanges).toEqual([{ startLine: 0, endLine: 3, level: 0, kind: 'scalar' }])
    expect(model.tokensAt(1)).toEqual([{ type: 'string', start: 0, end: 3 }])
  })

  it('folds a multi-line array', () => {
    const model = doc(['xs = [', '  1,', '  2,', ']', 'y = 1'].join('\n'))
    expect(model.foldingRanges).toEqual([
      { startLine: 0, endLine: 3, level: 0, kind: 'array', summary: '[…]' },
    ])
  })

  it('tokenizes headers, keys, strings and numbers', () => {
    const model = doc(['[package]', 'name = "krona"', 'version = 3', 'ok = true'].join('\n'))
    expect(model.tokensAt(0)).toEqual([{ type: 'section', start: 0, end: 9 }])
    expect(model.tokensAt(1).map((t) => t.type)).toEqual(['key', 'punctuation', 'string'])
    expect(model.tokensAt(2).at(-1)?.type).toBe('number')
    expect(model.tokensAt(3).at(-1)?.type).toBe('boolean')
  })

  it('reads quoted key segments in a header', () => {
    const model = doc(['["weird.key"]', 'a = 1', '[other]', 'b = 2'].join('\n'))
    expect(model.foldingRanges.map((r) => r.level)).toEqual([0, 0])
  })

  it('treats inline table keys as keys', () => {
    const model = doc('dep = { version = "1.0", optional = true }')
    const keys = model.tokensAt(0).filter((t) => t.type === 'key')
    expect(keys).toHaveLength(3)
  })

  it('marks comments', () => {
    const model = doc('# top\nx = 1 # trailing')
    expect(model.tokensAt(0)).toEqual([{ type: 'comment', start: 0, end: 5 }])
    expect(model.tokensAt(1).at(-1)?.type).toBe('comment')
  })

  it('survives an unterminated multi-line string', () => {
    const model = doc(['x = """', 'never closed'].join('\n'))
    expect(model.foldingRanges).toEqual([{ startLine: 0, endLine: 1, level: 0, kind: 'scalar' }])
  })

  it('degrades gracefully on garbage', () => {
    const model = doc('[[[[[[\n=====\n]]]]]]')
    expect(() => model.tokensAt(0)).not.toThrow()
    expect(() => model.tokensAt(1)).not.toThrow()
  })
})
