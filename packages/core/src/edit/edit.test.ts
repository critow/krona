import { describe, expect, it } from 'vitest'
import '../formats/json'
import '../formats/yaml'
import { parseDocument } from '../model/document'
import { applyEdit, blockSpanAt, lineSpanAt, removeBlockEdit, valueSpansAt } from './edit'

const JSON_DOC = [
  '{',
  '  "name": "krona",',
  '  "server": {',
  '    "host": "0.0.0.0",',
  '    "timeouts": { "read": 30, "write": 60 }',
  '  },',
  '  "last": true',
  '}',
].join('\n')

function parse(source: string, format = 'json') {
  return parseDocument(source, format)
}

function textOf(source: string, span: { start: number; end: number }): string {
  return source.slice(span.start, span.end)
}

describe('applyEdit', () => {
  it('replaces the span and hands back the edit that undoes it', () => {
    const { source, inverse } = applyEdit('abcdef', { start: 2, end: 4, text: 'XYZ' })
    expect(source).toBe('abXYZef')
    expect(applyEdit(source, inverse).source).toBe('abcdef')
  })

  it('round-trips an insertion and a deletion', () => {
    const inserted = applyEdit('ab', { start: 1, end: 1, text: '--' })
    expect(inserted.source).toBe('a--b')
    expect(applyEdit(inserted.source, inserted.inverse).source).toBe('ab')

    const deleted = applyEdit('abcd', { start: 1, end: 3, text: '' })
    expect(deleted.source).toBe('ad')
    expect(applyEdit(deleted.source, deleted.inverse).source).toBe('abcd')
  })

  it('refuses a span outside the document', () => {
    expect(() => applyEdit('ab', { start: 0, end: 9, text: '' })).toThrow(RangeError)
    expect(() => applyEdit('ab', { start: 2, end: 1, text: '' })).toThrow(RangeError)
  })
})

describe('spans', () => {
  it('finds every value on a line, left to right', () => {
    const model = parse(JSON_DOC)
    expect(valueSpansAt(model, 4).map((span) => textOf(JSON_DOC, span))).toEqual(['30', '60'])
    expect(valueSpansAt(model, 1).map((span) => textOf(JSON_DOC, span))).toEqual(['"krona"'])
    expect(valueSpansAt(model, 6).map((span) => textOf(JSON_DOC, span))).toEqual(['true'])
  })

  it('reports no value on a line that only opens a block', () => {
    const model = parse(JSON_DOC)
    expect(valueSpansAt(model, 2)).toEqual([])
  })

  it('covers a whole block, and just the line when there is none', () => {
    const model = parse(JSON_DOC)
    expect(textOf(JSON_DOC, blockSpanAt(model, 2) as { start: number; end: number })).toBe(
      [
        '  "server": {',
        '    "host": "0.0.0.0",',
        '    "timeouts": { "read": 30, "write": 60 }',
        '  },',
      ].join('\n'),
    )
    expect(textOf(JSON_DOC, lineSpanAt(model, 1) as { start: number; end: number })).toBe(
      '  "name": "krona",',
    )
  })

  it('locates values in a YAML document just the same', () => {
    const yaml = ['name: krona', 'server:', '  host: 0.0.0.0'].join('\n')
    const model = parse(yaml, 'yaml')
    expect(valueSpansAt(model, 0).map((span) => textOf(yaml, span))).toEqual(['krona'])
  })
})

describe('removeBlockEdit', () => {
  it('removes an entry along with its line break', () => {
    const model = parse(JSON_DOC)
    const edit = removeBlockEdit(model, 1)
    expect(edit).toBeDefined()
    if (!edit) return
    expect(applyEdit(JSON_DOC, edit).source).toBe(
      [
        '{',
        '  "server": {',
        '    "host": "0.0.0.0",',
        '    "timeouts": { "read": 30, "write": 60 }',
        '  },',
        '  "last": true',
        '}',
      ].join('\n'),
    )
  })

  it('removes a whole block, not just the line that opens it', () => {
    const model = parse(JSON_DOC)
    const edit = removeBlockEdit(model, 2)
    expect(edit).toBeDefined()
    if (!edit) return
    expect(applyEdit(JSON_DOC, edit).source).toBe(
      ['{', '  "name": "krona",', '  "last": true', '}'].join('\n'),
    )
  })

  it('takes the dangling comma with the last entry, leaving valid JSON', () => {
    const model = parse(JSON_DOC)
    const edit = removeBlockEdit(model, 6)
    expect(edit).toBeDefined()
    if (!edit) return
    const next = applyEdit(JSON_DOC, edit).source
    expect(next).not.toMatch(/,\s*}\s*$/)
    expect(parse(next).diagnostics).toEqual([])
  })

  it('leaves the neighbours alone when the entry is not the last one', () => {
    const model = parse(JSON_DOC)
    const edit = removeBlockEdit(model, 3)
    expect(edit).toBeDefined()
    if (!edit) return
    expect(parse(applyEdit(JSON_DOC, edit).source).diagnostics).toEqual([])
  })
})
