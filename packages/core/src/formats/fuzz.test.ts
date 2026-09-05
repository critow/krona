import { describe, expect, it } from 'vitest'
import '../index'
import '../formats/hcl'
import '../formats/json5'
import '../formats/properties'
import '../formats/xml'
import '../formats/yaml'
import { parseDocument } from '../model/document'

/**
 * Deterministic PRNG so a failure is reproducible from the seed printed in the
 * assertion message rather than "it failed once in CI".
 */
function makeRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    state >>>= 0
    return state / 0x1_0000_0000
  }
}

const ALPHABET = [
  '{',
  '}',
  '[',
  ']',
  ':',
  ',',
  '"',
  "'",
  '=',
  '#',
  ';',
  '-',
  '|',
  '>',
  '&',
  '*',
  '!',
  '?',
  '.',
  '\\',
  '/',
  '\n',
  '\t',
  ' ',
  'a',
  'Z',
  '0',
  '9',
  'ключ',
  '🚀',
  String.fromCharCode(0x202e),
  String.fromCharCode(0x200b),
  '"'.repeat(3),
  "'".repeat(3),
  '[[',
  ']]',
  '---',
  '<<',
  // Enough markup, comment and heredoc punctuation for the alphabet to produce
  // input the newer providers can actually get lost in.
  '<a>',
  '</a>',
  '<!--',
  '-->',
  '<![CDATA[',
  ']]>',
  '<?',
  '?>',
  '/*',
  '*/',
  '//',
  '<<-EOT',
  '\\\n',
]

function randomSource(random: () => number, length: number): string {
  let out = ''
  for (let i = 0; i < length; i++) {
    const index = Math.floor(random() * ALPHABET.length)
    out += ALPHABET[index] ?? 'a'
  }
  return out
}

const FORMATS = ['json', 'json5', 'yaml', 'toml', 'ini', 'xml', 'hcl', 'properties'] as const

/**
 * Input built to nest as deeply as each format can, since that is what would
 * overflow a stack. A format with nothing to nest gets one very long line,
 * which is the other shape that goes wrong.
 */
const DEEP: Record<(typeof FORMATS)[number], string> = {
  json: `${'{"a":'.repeat(3000)}1${'}'.repeat(3000)}`,
  json5: `${'{a:'.repeat(3000)}1${'}'.repeat(3000)}`,
  yaml: Array.from({ length: 3000 }, (_, i) => `${'  '.repeat(i)}k: 1`).join('\n'),
  toml: `${'{"a":'.repeat(3000)}1${'}'.repeat(3000)}`,
  ini: `${'{"a":'.repeat(3000)}1${'}'.repeat(3000)}`,
  xml: `${'<a>'.repeat(3000)}text${'</a>'.repeat(3000)}`,
  hcl: `${'a = {'.repeat(3000)}${'}'.repeat(3000)}`,
  properties: `a = ${'\\\n  more'.repeat(3000)}`,
}

describe.each(FORMATS)('%s provider fuzzing', (format) => {
  it('never throws and never hangs on random input', () => {
    for (let seed = 1; seed <= 120; seed++) {
      const random = makeRandom(seed * 2654435761)
      const source = randomSource(random, 200)
      const started = performance.now()
      const model = parseDocument(source, format)
      // Tokenize every line: lazy tokenization must be as robust as analysis.
      expect(() => {
        for (let line = 0; line < model.lines.length; line++) model.tokensAt(line)
      }, `seed ${seed}`).not.toThrow()
      expect(performance.now() - started, `seed ${seed} was slow`).toBeLessThan(500)
    }
  })

  it('produces folding ranges that are always well formed', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const random = makeRandom(seed * 40503)
      const model = parseDocument(randomSource(random, 400), format)
      for (const range of model.foldingRanges) {
        expect(range.startLine, `seed ${seed}`).toBeGreaterThanOrEqual(0)
        expect(range.endLine, `seed ${seed}`).toBeGreaterThan(range.startLine)
        expect(range.endLine, `seed ${seed}`).toBeLessThan(model.lines.length)
        expect(range.level, `seed ${seed}`).toBeGreaterThanOrEqual(0)
      }
    }
  })

  it('produces tokens that stay inside their line and never overlap', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const random = makeRandom(seed * 2246822519)
      const model = parseDocument(randomSource(random, 300), format)
      for (let line = 0; line < model.lines.length; line++) {
        const text = model.lines[line]?.text ?? ''
        let previousEnd = 0
        for (const token of model.tokensAt(line)) {
          expect(token.start, `seed ${seed} line ${line}`).toBeGreaterThanOrEqual(previousEnd)
          expect(token.end, `seed ${seed} line ${line}`).toBeGreaterThan(token.start)
          expect(token.end, `seed ${seed} line ${line}`).toBeLessThanOrEqual(text.length)
          previousEnd = token.end
        }
      }
    }
  })

  // The timeout is raised, not the work reduced. The YAML case builds nine
  // megabytes of source and parses every line of it — that is the point — which
  // takes a few hundred milliseconds on its own and long enough under coverage
  // instrumentation to cross the default five seconds. A test that fails for
  // being watched teaches nothing. The number is a ceiling, not a budget.
  const DEEP_TIMEOUT = 30_000

  it(
    'handles deeply nested input without overflowing the stack',
    () => {
      const source = DEEP[format]
      expect(() => parseDocument(source, format)).not.toThrow()
    },
    DEEP_TIMEOUT,
  )
})
