import { pathSegmentOf } from '../model/path'
import { registerFormat } from '../model/registry'
import type {
  AnalysisResult,
  FoldRange,
  FormatProvider,
  LineStates,
  ResolvedParseOptions,
  Token,
} from '../model/types'
import { classifyScalar, indentOf, isBlank, push } from './shared'

/** Bit set on a line that is the continuation of the value above it. */
const IN_VALUE = 1

const isComment = (text: string, at: number): boolean => {
  const code = text.charCodeAt(at)
  return code === 35 /* # */ || code === 33 /* ! */
}

const isSpace = (code: number): boolean => code === 32 || code === 9 || code === 12

/**
 * True when the line ends in a backslash that escapes the line break.
 *
 * An even number of them is a value ending in a literal backslash, which is why
 * counting is the only way to answer this.
 */
function continues(text: string): boolean {
  let slashes = 0
  for (let i = text.length - 1; i >= 0 && text.charCodeAt(i) === 92; i--) slashes++
  return slashes % 2 === 1
}

/**
 * Where the key ends and the separator begins.
 *
 * A key runs to the first unescaped `=`, `:` or run of whitespace: all three
 * separate, which is why `server.port 8080` is a pair and not a key nobody gave
 * a value to. Returns the end of the key, the separator character where there
 * is one, and where the value starts.
 */
function splitEntry(text: string, from: number): { key: number; mark: number; value: number } {
  let i = from
  for (; i < text.length; i++) {
    const code = text.charCodeAt(i)
    if (code === 92 /* \ */) {
      i++
      continue
    }
    if (code === 61 || code === 58 /* = : */) {
      return { key: i, mark: i, value: skipSpace(text, i + 1) }
    }
    if (isSpace(code)) {
      const next = skipSpace(text, i)
      const code2 = text.charCodeAt(next)
      // Whitespace before an `=` or a `:` is padding, not the separator.
      if (code2 === 61 || code2 === 58) {
        return { key: i, mark: next, value: skipSpace(text, next + 1) }
      }
      return { key: i, mark: -1, value: next }
    }
  }
  // A line ending in a backslash leaves the scan one past its end, since the
  // escape took the character after it — and a token reaching past the line it
  // is on is the one thing every renderer here assumes cannot happen.
  const end = Math.min(i, text.length)
  return { key: end, mark: -1, value: end }
}

function skipSpace(text: string, from: number): number {
  let i = from
  while (i < text.length && isSpace(text.charCodeAt(i))) i++
  return i
}

/**
 * Java properties files: one entry a line, with nothing to nest.
 *
 * The only structure here is a logical line spread over several physical ones,
 * so that is the only thing that folds. Dotted keys look like a hierarchy and
 * are not one — `a.b` and `a.c` are two unrelated keys as far as the format is
 * concerned — so nothing is invented from them beyond the path a reader copies.
 */
function analyze(
  _source: string,
  lines: readonly string[],
  options: ResolvedParseOptions,
): AnalysisResult {
  const ranges: FoldRange[] = []
  const states: LineStates = new Uint8Array(lines.length)
  const segments: (string | undefined)[] = new Array(lines.length)
  const { maxFoldRanges } = options.limits
  let continued = false

  for (let i = 0; i < lines.length; i++) {
    const text = lines[i] ?? ''
    if (continued) states[i] = IN_VALUE
    const wasContinued = continued
    continued = continues(text)

    if (wasContinued) continue
    if (isBlank(text)) continue
    const at = indentOf(text)
    if (isComment(text, at)) continue

    const { key } = splitEntry(text, at)
    const parts = keyParts(text.slice(at, key))
    if (parts.length > 0) segments[i] = pathSegmentOf(parts)

    if (!continues(text)) continue
    // The whole logical line folds to one row, the way a multi-line string does
    // in TOML: it is one entry however many lines it is written across.
    let end = i
    while (end + 1 < lines.length && continues(lines[end] ?? '')) end++
    if (end > i && ranges.length < maxFoldRanges) {
      ranges.push({ startLine: i, endLine: end, level: 0, kind: 'scalar' })
    }
  }

  return { foldingRanges: ranges, lineStates: states, pathSegments: segments }
}

/**
 * A key cut into the segments a path is made of, with its escapes taken off.
 *
 * Dots separate, because that is the convention every properties file in the
 * world follows — but only unescaped ones: `a\.b` is a single key with a dot in
 * its name. `server\:port` is likewise one key named `server:port`, and a path
 * still carrying the backslash would not match anything anyone pasted it into.
 */
function keyParts(raw: string): string[] {
  const parts: string[] = []
  let current = ''
  for (let i = 0; i < raw.length; i++) {
    const code = raw.charCodeAt(i)
    if (code === 92 && i + 1 < raw.length) {
      current += raw[i + 1]
      i++
      continue
    }
    if (code === 46 /* . */) {
      parts.push(current)
      current = ''
      continue
    }
    current += raw[i]
  }
  const last = current.trimEnd()
  if (last.length > 0 || parts.length > 0) parts.push(last)
  return parts.filter((part) => part.length > 0)
}

function tokenize(text: string, lineIndex: number, states: LineStates | undefined): Token[] {
  const tokens: Token[] = []
  if (((states?.[lineIndex] ?? 0) & IN_VALUE) !== 0) {
    // Everything on this line belongs to the value that began above it.
    push(tokens, 'string', indentOf(text), text.length)
    return tokens
  }

  const at = indentOf(text)
  if (at >= text.length) return tokens
  if (isComment(text, at)) {
    push(tokens, 'comment', at, text.length)
    return tokens
  }

  const { key, mark, value } = splitEntry(text, at)
  push(tokens, 'key', at, key)
  if (mark !== -1) push(tokens, 'punctuation', mark, mark + 1)
  if (value >= text.length) return tokens

  // A continued value is text: only half of it is on this line, and half of
  // `true` is not a boolean.
  const raw = text.slice(value).trimEnd()
  push(tokens, continues(text) ? 'string' : classifyScalar(raw), value, text.length)
  return tokens
}

/**
 * Confidence that this is a properties file rather than an INI one.
 *
 * The two overlap almost entirely, and INI reads a file of `a=b` lines just as
 * well, so this only claims what INI would get wrong: `!` comments, a value
 * continued onto the next line, and a key separated from its value by nothing
 * but a space.
 */
function detect(_source: string, lines: readonly string[]): number {
  const scanned = Math.min(lines.length, 200)
  let entries = 0
  let distinctive = 0
  let other = 0
  let continued = false

  for (let i = 0; i < scanned; i++) {
    const text = lines[i] ?? ''
    const wasContinued = continued
    continued = continues(text)
    if (wasContinued) continue
    if (isBlank(text)) continue
    const at = indentOf(text)
    if (isComment(text, at)) {
      if (text.charCodeAt(at) === 33 /* ! */) distinctive++
      continue
    }
    // A section header is INI's, and this format has none.
    if (text.charCodeAt(at) === 91 /* [ */) return 0
    const { key, mark, value } = splitEntry(text, at)
    if (key === text.length) {
      other++
      continue
    }
    entries++
    if (mark === -1 && value < text.length) distinctive++
    if (continued) distinctive++
  }

  if (entries === 0 || other > entries) return 0
  return distinctive > 0 ? 0.5 : 0.2
}

/**
 * Java `.properties`: `#` and `!` comments, `=`, `:` or a space between a key
 * and its value, and values continued with a trailing backslash.
 */
export const propertiesProvider: FormatProvider = {
  id: 'properties',
  displayName: 'Java properties',
  extensions: ['.properties'],
  detect,
  analyze,
  tokenize,
}

registerFormat(propertiesProvider)
