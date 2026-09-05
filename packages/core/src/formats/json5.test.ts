import { describe, expect, it } from 'vitest'
import { parseDocument } from '../model/document'
import { detectFormat } from '../model/registry'
import '../index'
import './json5'

const doc = (source: string) => parseDocument(source, 'json5')

const SOURCE = [
  '{',
  '  // the port the server listens on',
  '  port: 8080,',
  "  host: 'localhost',",
  '  tls: {',
  '    ciphers: [',
  "      'TLS_AES_128_GCM_SHA256',",
  '    ],',
  '  },',
  '}',
].join('\n')

describe('json5 provider', () => {
  it('folds objects and arrays, counting what each holds', () => {
    const model = doc(SOURCE)
    expect(model.foldingRanges).toEqual([
      { startLine: 0, endLine: 9, level: 0, kind: 'object', summary: '{…}', childCount: 3 },
      { startLine: 4, endLine: 8, level: 1, kind: 'object', summary: '{…}', childCount: 1 },
      { startLine: 5, endLine: 7, level: 2, kind: 'array', summary: '[…]', childCount: 1 },
    ])
  })

  it('reads an unquoted key as a key', () => {
    const model = doc(SOURCE)
    expect(model.tokensAt(2)).toEqual([
      { type: 'key', start: 2, end: 6 },
      { type: 'punctuation', start: 6, end: 7 },
      { type: 'number', start: 8, end: 12 },
      { type: 'punctuation', start: 12, end: 13 },
    ])
  })

  it('reads a single-quoted string, and the key it belongs to', () => {
    const model = doc(SOURCE)
    expect(model.tokensAt(3).map((token) => token.type)).toEqual([
      'key',
      'punctuation',
      'string',
      'punctuation',
    ])
  })

  it('gives every line the path to what it introduces', () => {
    const model = doc(SOURCE)
    expect(model.pathAt(2)).toBe('port')
    expect(model.pathAt(6)).toBe('tls.ciphers[0]')
  })

  it('marks both kinds of comment, across the lines a block comment covers', () => {
    const model = doc(['{', '  /* one', '     two */', '  a: 1, // trailing', '}'].join('\n'))
    expect(model.tokensAt(1)).toEqual([{ type: 'comment', start: 2, end: 8 }])
    expect(model.tokensAt(2)).toEqual([{ type: 'comment', start: 0, end: 11 }])
    expect(model.tokensAt(3).at(-1)).toEqual({ type: 'comment', start: 8, end: 19 })
  })

  it('keeps a brace inside a comment or a string out of the structure', () => {
    // The scanner has to be one scanner: a `{` the highlighter paints as text
    // and the folder counts as a block is a viewer that lies about the file.
    const model = doc(['{', '  // {', "  a: '{',", '}'].join('\n'))
    expect(model.foldingRanges).toEqual([
      { startLine: 0, endLine: 3, level: 0, kind: 'object', summary: '{…}', childCount: 1 },
    ])
  })

  it('reads the numbers JSON has no room for', () => {
    const model = doc(
      ['{', '  a: 0xdecaf,', '  b: +1.5e3,', '  c: .5,', '  d: Infinity,', '}'].join('\n'),
    )
    for (const line of [1, 2, 3, 4]) {
      expect(
        model.tokensAt(line).map((t) => t.type),
        `line ${line}`,
      ).toEqual(['key', 'punctuation', 'number', 'punctuation'])
    }
  })

  it('carries a string continued with a backslash onto the next line', () => {
    const model = doc(['{', "  a: 'one \\", "     two',", '}'].join('\n'))
    expect(model.tokensAt(2)).toEqual([
      { type: 'string', start: 0, end: 9 },
      { type: 'punctuation', start: 9, end: 10 },
    ])
    // Still one entry, not two: the second line is inside the string.
    expect(model.foldingRanges[0]?.childCount).toBe(1)
  })

  it('reports an unterminated string, an unclosed bracket and a stray one', () => {
    expect(doc(['{', "  a: 'never closed", '}'].join('\n')).diagnostics[0]).toMatchObject({
      code: 'json5-unterminated-string',
      line: 1,
    })
    expect(doc('{\n  a: 1\n').diagnostics[0]).toMatchObject({ code: 'json5-unclosed', line: 0 })
    expect(doc('}\n').diagnostics[0]).toMatchObject({ code: 'json5-unexpected-close', line: 0 })
  })

  it('folds an unclosed container to the end of the file', () => {
    const model = doc('{\n  a: [\n    1,\n')
    expect(model.foldingRanges.map((range) => [range.startLine, range.endLine])).toEqual([
      [0, 2],
      [1, 2],
    ])
  })

  it('is chosen over JSON only where JSON could not hold the file', () => {
    const lines = (source: string) => source.split('\n')
    // Valid JSON is JSON, whoever else could read it.
    expect(detectFormat('{\n  "a": 1\n}', lines('{\n  "a": 1\n}'))).toBe('json')
    expect(detectFormat('{\n  a: 1\n}', lines('{\n  a: 1\n}'))).toBe('json5')
    expect(detectFormat("{\n  'a': 1\n}", lines("{\n  'a': 1\n}"))).toBe('json5')
  })

  it('degrades gracefully on garbage', () => {
    const model = doc('{{{{[[[\n::::,,,\n\'"\'"\n]]]}}}')
    for (let line = 0; line < model.lines.length; line++) {
      expect(() => model.tokensAt(line)).not.toThrow()
    }
  })
})
