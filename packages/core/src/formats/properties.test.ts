import { describe, expect, it } from 'vitest'
import { parseDocument } from '../model/document'
import { detectFormat } from '../model/registry'
import '../index'
import './properties'

const doc = (source: string) => parseDocument(source, 'properties')

describe('properties provider', () => {
  it('takes all three separators, and neither comment for a value', () => {
    const model = doc(
      ['# a hash comment', '! and a bang one', 'a=1', 'b : two', 'c three'].join('\n'),
    )
    expect(model.tokensAt(0)).toEqual([{ type: 'comment', start: 0, end: 16 }])
    expect(model.tokensAt(1)).toEqual([{ type: 'comment', start: 0, end: 16 }])
    expect(model.tokensAt(2)).toEqual([
      { type: 'key', start: 0, end: 1 },
      { type: 'punctuation', start: 1, end: 2 },
      { type: 'number', start: 2, end: 3 },
    ])
    expect(model.tokensAt(3)).toEqual([
      { type: 'key', start: 0, end: 1 },
      { type: 'punctuation', start: 2, end: 3 },
      { type: 'string', start: 4, end: 7 },
    ])
    // A space separates too, which is what INI would read as a key on its own.
    expect(model.tokensAt(4)).toEqual([
      { type: 'key', start: 0, end: 1 },
      { type: 'string', start: 2, end: 7 },
    ])
  })

  it('folds a value continued over several lines, and paints every one of them', () => {
    const model = doc(
      ['ciphers = one, \\', '          two, \\', '          three', 'other = 1'].join('\n'),
    )
    expect(model.foldingRanges).toEqual([{ startLine: 0, endLine: 2, level: 0, kind: 'scalar' }])
    expect(model.tokensAt(1)).toEqual([{ type: 'string', start: 10, end: 16 }])
    expect(model.tokensAt(2)).toEqual([{ type: 'string', start: 10, end: 15 }])
    // The line after the last continuation is an entry again.
    expect(model.tokensAt(3).at(0)).toEqual({ type: 'key', start: 0, end: 5 })
  })

  it('counts the backslashes, so a value ending in one is not continued', () => {
    const model = doc(['path = C:\\\\dir\\\\', 'next = 1'].join('\n'))
    expect(model.foldingRanges).toEqual([])
    expect(model.tokensAt(1).at(0)).toEqual({ type: 'key', start: 0, end: 4 })
  })

  it('gives a dotted key the path it reads as', () => {
    const model = doc('server.tls.port = 8443')
    expect(model.pathAt(0)).toBe('server.tls.port')
  })

  it('keeps an escaped dot inside the segment it belongs to', () => {
    // `a\.b` is one key with a dot in its name, not a key under `a`.
    expect(doc('a\\.b = 1').pathAt(0)).toBe('["a.b"]')
    expect(doc('a.b = 1').pathAt(0)).toBe('a.b')
  })

  it('takes the escapes off a key before making it a path', () => {
    // `server\:port` is one key named `server:port`; a path carrying the
    // backslash would not match anything anyone pasted it into.
    const model = doc('server\\:port = 8080')
    expect(model.pathAt(0)).toBe('["server:port"]')
    expect(model.tokensAt(0)).toEqual([
      { type: 'key', start: 0, end: 12 },
      { type: 'punctuation', start: 13, end: 14 },
      { type: 'number', start: 15, end: 19 },
    ])
  })

  it('is chosen only over what INI would read wrongly', () => {
    const lines = (source: string) => source.split('\n')
    // Plain assignments: INI reads them just as well, and was here first.
    const plain = 'a=1\nb=2'
    expect(detectFormat(plain, lines(plain))).toBe('ini')
    // Section headers belong to the formats that have them, and this one has
    // none: it declines rather than competing for the file.
    const sections = '[a]\nb=2'
    expect(detectFormat(sections, lines(sections))).not.toBe('properties')
    const bang = '! a comment\na=1'
    expect(detectFormat(bang, lines(bang))).toBe('properties')
    const spaced = 'server.port 8080\nserver.host localhost'
    expect(detectFormat(spaced, lines(spaced))).toBe('properties')
  })

  it('degrades gracefully on garbage', () => {
    const model = doc('\\\\\\\n====\n:::\n   ')
    for (let line = 0; line < model.lines.length; line++) {
      expect(() => model.tokensAt(line)).not.toThrow()
    }
  })
})
