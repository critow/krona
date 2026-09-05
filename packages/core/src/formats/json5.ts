import { pathSegmentOf } from '../model/path'
import { registerFormat } from '../model/registry'
import type {
  AnalysisResult,
  Diagnostic,
  FoldRange,
  FormatProvider,
  LineStates,
  ResolvedParseOptions,
  Token,
  TokenType,
} from '../model/types'
import { push } from './shared'

/** Bit set on a line that begins inside an unterminated block comment. */
const IN_BLOCK_COMMENT = 1
/** Bit set on a line that begins inside a string continued from the one above. */
const IN_STRING_DOUBLE = 2
const IN_STRING_SINGLE = 4
const IN_STRING = IN_STRING_DOUBLE | IN_STRING_SINGLE

const MAX_REPORTED_ERRORS = 20

/** What the line scanner tells the analyzer about the structure it walked. */
type Event =
  | { readonly kind: 'open'; readonly bracket: 'object' | 'array' }
  | { readonly kind: 'close'; readonly bracket: 'object' | 'array' }
  | { readonly kind: 'key'; readonly name: string }
  | { readonly kind: 'value' }
  | { readonly kind: 'comma' }
  | { readonly kind: 'unterminated'; readonly what: 'string' | 'comment' }

const isDigit = (code: number): boolean => code >= 48 && code <= 57

/**
 * Characters JSON5 allows in an unquoted key.
 *
 * The specification says "any ECMAScript identifier", which includes every
 * Unicode letter and a `\u` escape. This is the ASCII core of that plus `$` and
 * `_`: a key outside it is still scanned, just as a quoted string would be, so
 * the worst case is a key that highlights as text rather than as a key.
 */
function isIdentifierChar(code: number): boolean {
  return (
    (code >= 97 && code <= 122) ||
    (code >= 65 && code <= 90) ||
    isDigit(code) ||
    code === 36 /* $ */ ||
    code === 95 /* _ */ ||
    code > 127
  )
}

/** True when a line ends in a backslash that escapes the line break itself. */
function endsEscaped(text: string, from: number): boolean {
  let slashes = 0
  for (let i = text.length - 1; i >= from && text.charCodeAt(i) === 92; i--) slashes++
  return slashes % 2 === 1
}

/**
 * Scans one line, from the state the line above left behind.
 *
 * One scanner, two callers: the analyzer runs it over every line to find the
 * structure, and `tokenize` runs it over a single line to paint it. A format
 * whose highlighting and whose folding disagreed would be worse than either
 * alone, and the only way to be sure they cannot is to have one of them.
 */
function scanLine(
  text: string,
  state: number,
  tokens: Token[] | null,
  events: Event[] | null,
): number {
  let i = 0
  const emit = (type: TokenType, start: number, end: number) => {
    if (tokens) push(tokens, type, start, end)
  }
  const note = (event: Event) => {
    if (events) events.push(event)
  }

  if ((state & IN_BLOCK_COMMENT) !== 0) {
    const end = text.indexOf('*/')
    if (end === -1) {
      emit('comment', 0, text.length)
      return IN_BLOCK_COMMENT
    }
    emit('comment', 0, end + 2)
    i = end + 2
    state = 0
  } else if ((state & IN_STRING) !== 0) {
    const quote = (state & IN_STRING_DOUBLE) !== 0 ? 34 : 39
    const end = scanString(text, 0, quote, true)
    emit('string', 0, end.end)
    if (end.open) return state
    i = end.end
    state = 0
  }

  while (i < text.length) {
    const code = text.charCodeAt(i)

    if (code === 32 || code === 9 || code === 13) {
      i++
      continue
    }

    if (code === 47 /* / */) {
      const next = text.charCodeAt(i + 1)
      if (next === 47) {
        emit('comment', i, text.length)
        return 0
      }
      if (next === 42 /* * */) {
        const end = text.indexOf('*/', i + 2)
        if (end === -1) {
          emit('comment', i, text.length)
          note({ kind: 'unterminated', what: 'comment' })
          return IN_BLOCK_COMMENT
        }
        emit('comment', i, end + 2)
        i = end + 2
        continue
      }
      i++
      continue
    }

    if (code === 34 || code === 39 /* " or ' */) {
      const start = i
      const scanned = scanString(text, i, code, false)
      i = scanned.end
      const name = text.slice(start + 1, scanned.open ? text.length : Math.max(start + 1, i - 1))
      if (scanned.open) {
        // Only a backslash at the very end continues a string onto the next
        // line; anything else is a string nobody closed.
        if (endsEscaped(text, start)) {
          emit('string', start, text.length)
          return code === 34 ? IN_STRING_DOUBLE : IN_STRING_SINGLE
        }
        emit('string', start, text.length)
        note({ kind: 'unterminated', what: 'string' })
        return 0
      }
      if (followedByColon(text, i)) {
        emit('key', start, i)
        note({ kind: 'key', name })
      } else {
        emit('string', start, i)
        note({ kind: 'value' })
      }
      continue
    }

    if (code === 123 || code === 91 /* { [ */) {
      emit('punctuation', i, i + 1)
      note({ kind: 'open', bracket: code === 123 ? 'object' : 'array' })
      i++
      continue
    }

    if (code === 125 || code === 93 /* } ] */) {
      emit('punctuation', i, i + 1)
      note({ kind: 'close', bracket: code === 125 ? 'object' : 'array' })
      i++
      continue
    }

    if (code === 44 /* , */) {
      emit('punctuation', i, i + 1)
      note({ kind: 'comma' })
      i++
      continue
    }

    if (code === 58 /* : */) {
      emit('punctuation', i, i + 1)
      i++
      continue
    }

    if (isDigit(code) || code === 43 || code === 45 || code === 46) {
      const start = i
      i = scanNumber(text, i)
      if (i > start) {
        emit('number', start, i)
        note({ kind: 'value' })
        continue
      }
      i++
      continue
    }

    if (isIdentifierChar(code)) {
      const start = i
      while (i < text.length && isIdentifierChar(text.charCodeAt(i))) i++
      const word = text.slice(start, i)
      if (followedByColon(text, i)) {
        // JSON5's one real convenience over JSON: `{ port: 8080 }`.
        emit('key', start, i)
        note({ kind: 'key', name: word })
        continue
      }
      emit(wordType(word), start, i)
      note({ kind: 'value' })
      continue
    }

    i++
  }
  return 0
}

function wordType(word: string): TokenType {
  if (word === 'true' || word === 'false') return 'boolean'
  if (word === 'null') return 'null'
  // `Infinity` and `NaN` are numbers in JSON5, and nowhere else in Krona.
  if (word === 'Infinity' || word === 'NaN') return 'number'
  return 'string'
}

/** Whether the next thing on the line, past spaces, is the `:` of a key. */
function followedByColon(text: string, from: number): boolean {
  let i = from
  while (i < text.length && (text.charCodeAt(i) === 32 || text.charCodeAt(i) === 9)) i++
  return text.charCodeAt(i) === 58
}

/**
 * Scans a quoted string. `open` says the line ended before the closing quote,
 * which in JSON5 means either a continuation or a string nobody closed.
 */
function scanString(
  text: string,
  start: number,
  quote: number,
  continuing: boolean,
): { end: number; open: boolean } {
  let i = continuing ? start : start + 1
  while (i < text.length) {
    const code = text.charCodeAt(i)
    if (code === 92 /* \ */) {
      i += 2
      continue
    }
    i++
    if (code === quote) return { end: i, open: false }
  }
  return { end: text.length, open: true }
}

/** Numbers, including hex, a leading or trailing point, and a sign. */
function scanNumber(text: string, start: number): number {
  let i = start
  if (text.charCodeAt(i) === 43 || text.charCodeAt(i) === 45) i++
  if (text.charCodeAt(i) === 48 && (text.charCodeAt(i + 1) | 32) === 120 /* x */) {
    i += 2
    const from = i
    while (i < text.length && isHex(text.charCodeAt(i))) i++
    return i > from ? i : start
  }
  let digits = 0
  let dot = false
  let exponent = false
  for (; i < text.length; i++) {
    const code = text.charCodeAt(i)
    if (isDigit(code)) {
      digits++
    } else if (code === 46 && !dot && !exponent) {
      dot = true
    } else if ((code | 32) === 101 /* e */ && digits > 0 && !exponent) {
      exponent = true
      const next = text.charCodeAt(i + 1)
      if (next === 43 || next === 45) i++
    } else {
      break
    }
  }
  return digits > 0 ? i : start
}

function isHex(code: number): boolean {
  return isDigit(code) || ((code | 32) >= 97 && (code | 32) <= 102)
}

interface Frame {
  readonly kind: 'object' | 'array'
  readonly startLine: number
  readonly level: number
  count: number
  /** True while the next value in an array is still to come. */
  awaiting: boolean
}

function analyze(
  _source: string,
  lines: readonly string[],
  options: ResolvedParseOptions,
): AnalysisResult {
  const ranges: FoldRange[] = []
  const diagnostics: Diagnostic[] = []
  const states: LineStates = new Uint8Array(lines.length)
  const segments: (string | undefined)[] = new Array(lines.length)
  const stack: Frame[] = []
  const { maxFoldRanges } = options.limits
  const lastLine = lines.length - 1
  const events: Event[] = []
  let state = 0

  const report = (message: string, code: string, line: number) => {
    if (diagnostics.length >= MAX_REPORTED_ERRORS) return
    diagnostics.push({ severity: 'error', code, message, line })
  }

  const close = (endLine: number) => {
    const frame = stack.pop()
    if (!frame || ranges.length >= maxFoldRanges || endLine <= frame.startLine) return
    ranges.push({
      startLine: frame.startLine,
      endLine,
      level: frame.level,
      kind: frame.kind,
      summary: frame.kind === 'object' ? '{…}' : '[…]',
      childCount: frame.count,
    })
  }

  for (let line = 0; line < lines.length; line++) {
    states[line] = state
    events.length = 0
    state = scanLine(lines[line] ?? '', state, null, events)

    for (const event of events) {
      const top = stack[stack.length - 1]
      switch (event.kind) {
        case 'key':
          if (top?.kind === 'object') top.count++
          // A path names a line, and `{ "a": 1, "b": 2 }` is one line however
          // many entries it holds, so only the first key on it is recorded.
          if (segments[line] === undefined) segments[line] = pathSegmentOf([event.name])
          break
        case 'value':
          if (top?.kind === 'array' && top.awaiting) {
            if (segments[line] === undefined) segments[line] = pathSegmentOf([top.count])
            top.count++
            top.awaiting = false
          }
          break
        case 'comma':
          if (top) top.awaiting = true
          break
        case 'open': {
          if (top?.kind === 'array' && top.awaiting) {
            if (segments[line] === undefined) segments[line] = pathSegmentOf([top.count])
            top.count++
            top.awaiting = false
          }
          stack.push({
            kind: event.bracket,
            startLine: line,
            level: stack.length,
            count: 0,
            awaiting: true,
          })
          break
        }
        case 'close':
          if (stack.length === 0) {
            report('Unexpected closing bracket', 'json5-unexpected-close', line)
            break
          }
          close(line)
          break
        case 'unterminated':
          report(
            event.what === 'string' ? 'Unterminated string' : 'Unterminated comment',
            `json5-unterminated-${event.what}`,
            line,
          )
          break
      }
    }
  }

  // Unterminated containers still fold to the end of the file, which is what an
  // editor does while you are half way through typing one.
  if (stack.length > 0) report('Unclosed bracket', 'json5-unclosed', stack[0]?.startLine ?? 0)
  while (stack.length > 0) close(lastLine)
  ranges.sort((a, b) => a.startLine - b.startLine || a.level - b.level)

  return { foldingRanges: ranges, diagnostics, lineStates: states, pathSegments: segments }
}

function tokenize(text: string, lineIndex: number, states: LineStates | undefined): Token[] {
  const tokens: Token[] = []
  scanLine(text, states?.[lineIndex] ?? 0, tokens, null)
  return tokens
}

/**
 * Confidence that this is JSON5 rather than JSON.
 *
 * Only what JSON cannot hold counts — an unquoted key, a single-quoted string.
 * A document that is valid JSON *is* JSON, and answering otherwise would take
 * every `.json` file away from a provider that reads it better.
 */
function detect(source: string, lines: readonly string[]): number {
  const trimmed = source.trimStart()
  const first = trimmed.charCodeAt(0)
  if (first !== 123 /* { */ && first !== 91 /* [ */) return 0

  const scanned = Math.min(lines.length, 200)
  let state = 0
  for (let i = 0; i < scanned; i++) {
    const text = lines[i] ?? ''
    const tokens: Token[] = []
    state = scanLine(text, state, tokens, null)
    for (const token of tokens) {
      if (token.type === 'key' && text.charCodeAt(token.start) !== 34) return 0.95
      if (token.type === 'string' && text.charCodeAt(token.start) === 39) return 0.95
    }
  }
  return 0
}

/**
 * JSON5: comments, unquoted keys, single quotes, trailing commas, hex numbers.
 *
 * A hand-written scanner rather than a parser, for the same reason the whole
 * library is line based: Krona needs the shape of the file and the class of
 * each span, never its value, and a scanner that never builds one cannot be
 * asked to build the wrong one.
 */
export const json5Provider: FormatProvider = {
  id: 'json5',
  displayName: 'JSON5',
  extensions: ['.json5'],
  detect,
  analyze,
  tokenize,
}

registerFormat(json5Provider)
