import { describe, expect, it } from 'vitest'
import { parseDocument } from '../model/document'
import '../index'

const doc = (source: string) => parseDocument(source, 'ini')

describe('ini provider', () => {
  it('folds sections and nests dotted names', () => {
    const model = doc(
      ['[server]', 'host = 0.0.0.0', '', '[server.tls]', 'enabled = yes', '', '[db]', 'x = 1'].join(
        '\n',
      ),
    )
    expect(model.foldingRanges).toEqual([
      { startLine: 0, endLine: 4, level: 0, kind: 'section', summary: '[…]' },
      { startLine: 3, endLine: 4, level: 1, kind: 'section', summary: '[…]' },
      { startLine: 6, endLine: 7, level: 0, kind: 'section', summary: '[…]' },
    ])
  })

  it('gives a dotenv file no folding at all', () => {
    const model = doc(['NODE_ENV=production', 'PORT=8080', '# comment', 'EMPTY='].join('\n'))
    expect(model.foldingRanges).toEqual([])
  })

  it('tokenizes both comment styles', () => {
    const model = doc('; semicolon\n# hash')
    expect(model.tokensAt(0)).toEqual([{ type: 'comment', start: 0, end: 11 }])
    expect(model.tokensAt(1)).toEqual([{ type: 'comment', start: 0, end: 6 }])
  })

  it('accepts both = and : separators', () => {
    const model = doc('a = 1\nb: 2')
    expect(model.tokensAt(0).map((t) => t.type)).toEqual(['key', 'punctuation', 'number'])
    expect(model.tokensAt(1).map((t) => t.type)).toEqual(['key', 'punctuation', 'number'])
  })

  it('drops the export keyword from dotenv keys', () => {
    const model = doc('export API_KEY=abc')
    const key = model.tokensAt(0)[0]
    expect(model.source.slice(key?.start, key?.end)).toBe('API_KEY')
  })

  it('keeps a hash inside an unspaced value out of the comment', () => {
    const model = doc('PASSWORD=p#ss')
    expect(model.tokensAt(0).some((t) => t.type === 'comment')).toBe(false)
  })

  it('detects an inline comment after whitespace', () => {
    const model = doc('LEVEL=info ; verbose')
    const comment = model.tokensAt(0).at(-1)
    expect(comment?.type).toBe('comment')
    expect(model.source.slice(comment?.start, comment?.end)).toBe('; verbose')
  })

  it('keeps quoted values whole', () => {
    const model = doc('SECRET="s3cr3t with spaces"')
    const value = model.tokensAt(0).at(-1)
    expect(value?.type).toBe('string')
    expect(model.source.slice(value?.start, value?.end)).toBe('"s3cr3t with spaces"')
  })

  it('classifies bare values', () => {
    const model = doc(['a=1', 'b=true', 'c=', 'd=text'].join('\n'))
    expect(model.tokensAt(0).at(-1)?.type).toBe('number')
    expect(model.tokensAt(1).at(-1)?.type).toBe('boolean')
    expect(model.tokensAt(2).at(-1)?.type).toBe('punctuation')
    expect(model.tokensAt(3).at(-1)?.type).toBe('string')
  })

  it('degrades gracefully on garbage', () => {
    const model = doc('[unclosed\n====\n[]')
    expect(model.foldingRanges).toEqual([])
    expect(() => model.tokensAt(0)).not.toThrow()
  })
})
