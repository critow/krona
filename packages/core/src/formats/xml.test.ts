import { describe, expect, it } from 'vitest'
import { parseDocument } from '../model/document'
import { detectFormat } from '../model/registry'
import '../index'
import './xml'

const doc = (source: string) => parseDocument(source, 'xml')

const SOURCE = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<server name="edge">',
  '  <!-- what the edge listens on -->',
  '  <listen port="8080" tls="true" />',
  '  <upstreams>',
  '    <upstream>10.0.0.1</upstream>',
  '    <upstream>10.0.0.2</upstream>',
  '  </upstreams>',
  '</server>',
].join('\n')

describe('xml provider', () => {
  it('folds each element from its start tag to its end tag', () => {
    const model = doc(SOURCE)
    expect(model.foldingRanges).toEqual([
      {
        startLine: 1,
        endLine: 8,
        level: 0,
        kind: 'element',
        summary: '<server>',
        childCount: 2,
      },
      {
        startLine: 4,
        endLine: 7,
        level: 1,
        kind: 'element',
        summary: '<upstreams>',
        childCount: 2,
      },
    ])
  })

  it('leaves a self-closing element and a one-line one unfolded', () => {
    // Nothing is hidden behind either, so a chevron on them would be furniture.
    const model = doc(SOURCE)
    expect(model.foldingRanges.some((range) => range.startLine === 3)).toBe(false)
    expect(model.foldingRanges.some((range) => range.startLine === 5)).toBe(false)
  })

  it('paints tag names, attributes and their values apart', () => {
    const model = doc(SOURCE)
    expect(model.tokensAt(3)).toEqual([
      { type: 'punctuation', start: 2, end: 3 },
      { type: 'section', start: 3, end: 9 },
      { type: 'key', start: 10, end: 14 },
      { type: 'punctuation', start: 14, end: 15 },
      { type: 'string', start: 15, end: 21 },
      { type: 'key', start: 22, end: 25 },
      { type: 'punctuation', start: 25, end: 26 },
      { type: 'string', start: 26, end: 32 },
      { type: 'punctuation', start: 33, end: 35 },
    ])
  })

  it('numbers repeated siblings so a path names one of them', () => {
    const model = doc(SOURCE)
    expect(model.pathAt(5)).toBe('server.upstreams.upstream')
    expect(model.pathAt(6)).toBe('server.upstreams.upstream[1]')
  })

  it('carries a comment and a CDATA section across the lines they cover', () => {
    const model = doc(
      ['<a>', '  <!-- one', '       two -->', '  <![CDATA[ x', '  ]]>', '</a>'].join('\n'),
    )
    expect(model.tokensAt(2)).toEqual([{ type: 'comment', start: 0, end: 14 }])
    expect(model.tokensAt(4)).toEqual([{ type: 'string', start: 0, end: 5 }])
    // A `<a>` inside either is text, not an element: one scanner answers both
    // the painter and the folder, so they cannot disagree about where it ends.
    expect(model.foldingRanges).toHaveLength(1)
  })

  it('keeps its place when a start tag runs over several lines', () => {
    const model = doc(
      ['<server', '  name="edge"', '  port="8080">', '  <a/>', '</server>'].join('\n'),
    )
    expect(model.tokensAt(1)).toEqual([
      { type: 'key', start: 2, end: 6 },
      { type: 'punctuation', start: 6, end: 7 },
      { type: 'string', start: 7, end: 13 },
    ])
    // The element began on the line its name is on, not where its `>` landed.
    expect(model.foldingRanges).toEqual([
      { startLine: 0, endLine: 4, level: 0, kind: 'element', summary: '<server>', childCount: 1 },
    ])
  })

  it('is not fooled by a > inside an attribute value', () => {
    const model = doc(['<a title="b > c">', '  <d/>', '</a>'].join('\n'))
    expect(model.tokensAt(0).at(-1)).toEqual({ type: 'punctuation', start: 16, end: 17 })
    expect(model.foldingRanges[0]).toMatchObject({ startLine: 0, endLine: 2, childCount: 1 })
  })

  it('says what was left open, and folds it to the end of the file anyway', () => {
    // A configuration file being edited is unclosed about half the time.
    const model = doc(['<a>', '  <b>', '    text', '</a>'].join('\n'))
    expect(model.diagnostics.map((d) => d.code)).toContain('xml-unclosed')
    expect(model.foldingRanges.map((r) => [r.startLine, r.endLine])).toEqual([
      [0, 3],
      [1, 3],
    ])

    // And a file that simply stops, with nothing closed at all.
    const open = doc(['<a>', '  <b>', '    text'].join('\n'))
    expect(open.diagnostics).toEqual([
      { severity: 'error', code: 'xml-unclosed', message: 'Unclosed <a>', line: 0 },
    ])
    expect(open.foldingRanges.map((r) => [r.startLine, r.endLine])).toEqual([
      [0, 2],
      [1, 2],
    ])
  })

  it('reports a closing tag that opens nothing', () => {
    expect(doc('<a></b></a>').diagnostics[0]).toMatchObject({
      code: 'xml-unexpected-close',
      line: 0,
    })
  })

  it('recognises a document by its declaration, and by tags that pair up', () => {
    const lines = (source: string) => source.split('\n')
    const declared = '<?xml version="1.0"?>\n<a/>'
    expect(detectFormat(declared, lines(declared))).toBe('xml')
    const plain = '<a>\n  <b>1</b>\n</a>'
    expect(detectFormat(plain, lines(plain))).toBe('xml')
    // JSON is still JSON, and a file of assignments is still INI.
    expect(detectFormat('{\n  "a": 1\n}', lines('{\n  "a": 1\n}'))).toBe('json')
    expect(detectFormat('a = 1\nb = 2', lines('a = 1\nb = 2'))).toBe('ini')
  })

  it('degrades gracefully on garbage', () => {
    const model = doc('<<<<>>>>\n</ / />\n<!--\n<![CDATA[')
    for (let line = 0; line < model.lines.length; line++) {
      expect(() => model.tokensAt(line)).not.toThrow()
    }
  })
})
