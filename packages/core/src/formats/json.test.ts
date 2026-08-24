import { describe, expect, it } from 'vitest'
import { parseDocument } from '../model/document'
import '../index'

const doc = (source: string) => parseDocument(source, 'json')
const range = (source: string, startLine: number) => doc(source).foldAt(startLine)

describe('json provider', () => {
  it('folds objects and arrays over their line span', () => {
    const model = doc(['{', '  "a": {', '    "b": 1', '  },', '  "c": [1, 2]', '}'].join('\n'))
    expect(model.format).toBe('json')
    expect(model.foldingRanges).toEqual([
      { startLine: 0, endLine: 5, level: 0, kind: 'object', summary: '{…}', childCount: 2 },
      { startLine: 1, endLine: 3, level: 1, kind: 'object', summary: '{…}', childCount: 1 },
    ])
  })

  it('does not fold single-line containers', () => {
    const model = doc('{ "a": { "b": 1 }, "c": [1, 2, 3] }')
    expect(model.foldingRanges).toEqual([])
  })

  it('does not fold empty containers spanning one line', () => {
    const model = doc('{ "empty": {}, "list": [] }')
    expect(model.foldingRanges).toEqual([])
  })

  it('counts array items', () => {
    const model = doc('{\n  "xs": [\n    1,\n    2,\n    3\n  ]\n}')
    expect(range(model.source, 1)?.childCount).toBe(3)
    expect(range(model.source, 1)?.kind).toBe('array')
  })

  it('tokenizes keys, strings, numbers, booleans and null', () => {
    const model = doc('{ "k": "v", "n": 1.5e3, "b": true, "z": null }')
    const types = model.tokensAt(0).map((t) => t.type)
    expect(types).toContain('key')
    expect(types).toContain('string')
    expect(types).toContain('number')
    expect(types).toContain('boolean')
    expect(types).toContain('null')
  })

  it('separates keys from string values by the following colon', () => {
    const model = doc('{"key": "value"}')
    const tokens = model.tokensAt(0)
    const key = tokens.find((t) => t.type === 'key')
    const value = tokens.find((t) => t.type === 'string')
    expect(model.source.slice(key?.start, key?.end)).toBe('"key"')
    expect(model.source.slice(value?.start, value?.end)).toBe('"value"')
  })

  it('supports JSONC line and block comments', () => {
    const source = ['{', '  // one', '  /* two', '     still two */', '  "a": 1', '}'].join('\n')
    const model = doc(source)
    expect(model.tokensAt(1)).toEqual([{ type: 'comment', start: 2, end: 8 }])
    expect(model.tokensAt(2)[0]?.type).toBe('comment')
    expect(model.tokensAt(3)).toEqual([{ type: 'comment', start: 0, end: 17 }])
    expect(model.tokensAt(4).some((t) => t.type === 'key')).toBe(true)
  })

  it('reports parse errors without throwing', () => {
    const model = doc('{ "a": }')
    expect(model.format).toBe('json')
    expect(model.diagnostics.length).toBeGreaterThan(0)
    expect(model.diagnostics[0]?.severity).toBe('error')
  })

  it('still folds an unterminated object', () => {
    const model = doc('{\n  "a": 1\n')
    expect(model.foldingRanges[0]?.startLine).toBe(0)
  })

  it('handles escaped quotes inside strings', () => {
    const model = doc('{ "a": "he said \\"hi\\"" }')
    const strings = model.tokensAt(0).filter((t) => t.type === 'string')
    expect(strings).toHaveLength(1)
    expect(model.source.slice(strings[0]?.start, strings[0]?.end)).toBe('"he said \\"hi\\""')
  })

  it('never materialises document values, so __proto__ keys are inert', () => {
    const model = doc('{ "__proto__": { "polluted": true } }')
    expect(model.format).toBe('json')
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
  })

  it('leaves empty input alone', () => {
    const model = doc('')
    expect(model.lines).toHaveLength(1)
    expect(model.foldingRanges).toEqual([])
  })
})
