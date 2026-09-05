import { describe, expect, it } from 'vitest'
import { hasUnsafeCharacters, scanUnsafeCharacters, visibleText } from './unicode'

// Built from code points rather than pasted literally: an invisible character
// in a test file is exactly the hazard these tests are about.
const RLO = String.fromCharCode(0x202e)
const ZWSP = String.fromCharCode(0x200b)
const BELL = String.fromCharCode(0x07)
const ROCKET = String.fromCodePoint(0x1f680)

describe('scanUnsafeCharacters', () => {
  it('finds bidirectional overrides (Trojan Source)', () => {
    const line = `access = ${RLO}admin`
    expect(scanUnsafeCharacters(line)).toEqual([
      { start: 9, end: 10, kind: 'bidi', codePoint: 0x202e, label: 'U+202E' },
    ])
  })

  it('finds zero-width characters', () => {
    expect(scanUnsafeCharacters(`a${ZWSP}b`)[0]).toMatchObject({ kind: 'invisible', start: 1 })
  })

  it('finds control characters but leaves tabs alone', () => {
    expect(scanUnsafeCharacters('a\tb')).toEqual([])
    expect(scanUnsafeCharacters(`a${BELL}b`)[0]).toMatchObject({ kind: 'control' })
  })

  it('returns nothing for ordinary text, including non-Latin scripts', () => {
    expect(scanUnsafeCharacters('ключ = значение')).toEqual([])
    expect(scanUnsafeCharacters(`emoji ${ROCKET} ok`)).toEqual([])
  })

  it('reports offsets in UTF-16 units so slicing a line stays correct', () => {
    const line = `${ROCKET}${RLO}x`
    const [span] = scanUnsafeCharacters(line)
    expect(span).toMatchObject({ start: 2, end: 3 })
    expect(line.slice(span?.start, span?.end)).toBe(RLO)
  })

  it('agrees with the allocation-free predicate', () => {
    for (const line of ['plain', `x${RLO}`, `y${ZWSP}`, 'tab\there']) {
      expect(hasUnsafeCharacters(line)).toBe(scanUnsafeCharacters(line).length > 0)
    }
  })
})

describe('visibleText', () => {
  it('writes a hidden character as its code, in place', () => {
    expect(visibleText('user\u202Eadmin')).toBe('userU+202Eadmin')
    expect(visibleText('a\u200Bb\u200Bc')).toBe('aU+200BbU+200Bc')
  })

  it('hands back text with nothing to hide, unchanged and identical', () => {
    const plain = 'server.tls.ciphers[0]'
    expect(visibleText(plain)).toBe(plain)
  })
})
