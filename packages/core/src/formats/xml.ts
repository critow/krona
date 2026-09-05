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

/** Bits describing what a line begins in the middle of. */
const IN_COMMENT = 1
const IN_CDATA = 2
/** Inside a start tag, past its name: attributes may run over several lines. */
const IN_TAG = 4
const IN_DECLARATION = 8
const IN_VALUE_DOUBLE = 16
const IN_VALUE_SINGLE = 32
const IN_VALUE = IN_VALUE_DOUBLE | IN_VALUE_SINGLE

const MAX_REPORTED_ERRORS = 20

/** What the line scanner tells the analyzer about the structure it walked. */
type Event =
  | { readonly kind: 'open'; readonly name: string }
  | { readonly kind: 'tagEnd'; readonly selfClosing: boolean }
  | { readonly kind: 'close'; readonly name: string }
  | { readonly kind: 'unterminated'; readonly what: 'comment' | 'cdata' }

const SPACE = new Set([32, 9, 13, 10])

/**
 * Characters XML allows in a name.
 *
 * The specification's set is enormous — most of Unicode, minus punctuation —
 * so this is the ASCII core of it plus everything above 127, which admits a few
 * characters a validating parser would reject. Krona is a viewer: a name it
 * accepts too readily highlights a byte the file already contains, while one it
 * refuses would leave a real element unpainted and unfoldable.
 */
function isNameChar(code: number): boolean {
  return (
    (code >= 97 && code <= 122) ||
    (code >= 65 && code <= 90) ||
    (code >= 48 && code <= 57) ||
    code === 45 /* - */ ||
    code === 46 /* . */ ||
    code === 58 /* : */ ||
    code === 95 /* _ */ ||
    code > 127
  )
}

function readName(text: string, from: number): number {
  let i = from
  while (i < text.length && isNameChar(text.charCodeAt(i))) i++
  return i
}

function skipSpace(text: string, from: number): number {
  let i = from
  while (i < text.length && SPACE.has(text.charCodeAt(i))) i++
  return i
}

/**
 * Scans one line, from the state the line above left behind.
 *
 * One scanner for the folding and the highlighting both: an element the painter
 * shows as text and the folder counts as a block would be a viewer that lies
 * about the file.
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

  if ((state & IN_COMMENT) !== 0) {
    const end = text.indexOf('-->')
    if (end === -1) {
      emit('comment', 0, text.length)
      return IN_COMMENT
    }
    emit('comment', 0, end + 3)
    i = end + 3
    state = 0
  } else if ((state & IN_CDATA) !== 0) {
    const end = text.indexOf(']]>')
    if (end === -1) {
      emit('string', 0, text.length)
      return IN_CDATA
    }
    emit('string', 0, end + 3)
    i = end + 3
    state = 0
  }

  // A start tag whose attributes run past the end of the line, or one attribute
  // value that does. Both are legal, and a viewer that lost its place at the
  // line break would repaint the rest of the file as text.
  if ((state & (IN_TAG | IN_DECLARATION)) !== 0) {
    const after = scanAttributes(text, i, state, emit, note)
    if (after.state !== 0) return after.state
    i = after.index
    state = 0
  }

  while (i < text.length) {
    if (text.charCodeAt(i) !== 60 /* < */) {
      i++
      continue
    }

    if (text.startsWith('<!--', i)) {
      const end = text.indexOf('-->', i + 4)
      if (end === -1) {
        emit('comment', i, text.length)
        note({ kind: 'unterminated', what: 'comment' })
        return IN_COMMENT
      }
      emit('comment', i, end + 3)
      i = end + 3
      continue
    }

    if (text.startsWith('<![CDATA[', i)) {
      const end = text.indexOf(']]>', i + 9)
      if (end === -1) {
        emit('string', i, text.length)
        note({ kind: 'unterminated', what: 'cdata' })
        return IN_CDATA
      }
      emit('string', i, end + 3)
      i = end + 3
      continue
    }

    if (text.startsWith('</', i)) {
      const nameEnd = readName(text, i + 2)
      emit('punctuation', i, i + 2)
      emit('section', i + 2, nameEnd)
      note({ kind: 'close', name: text.slice(i + 2, nameEnd) })
      const close = text.indexOf('>', nameEnd)
      if (close === -1) return 0
      emit('punctuation', close, close + 1)
      i = close + 1
      continue
    }

    // `<?xml …?>` and `<!DOCTYPE …>`: neither opens anything, so both are
    // painted and stepped over rather than pushed.
    if (text.startsWith('<?', i) || text.startsWith('<!', i)) {
      const nameEnd = readName(text, i + 2)
      emit('punctuation', i, i + 2)
      emit('section', i + 2, nameEnd)
      const after = scanAttributes(text, nameEnd, IN_DECLARATION, emit, note)
      if (after.state !== 0) return after.state
      i = after.index
      continue
    }

    const nameEnd = readName(text, i + 1)
    if (nameEnd === i + 1) {
      // A bare `<` in text content. Not an error worth reporting: plenty of
      // documents carry one, and the file is what it is.
      i++
      continue
    }
    emit('punctuation', i, i + 1)
    emit('section', i + 1, nameEnd)
    note({ kind: 'open', name: text.slice(i + 1, nameEnd) })
    const after = scanAttributes(text, nameEnd, IN_TAG, emit, note)
    if (after.state !== 0) return after.state
    i = after.index
  }
  return 0
}

/**
 * Scans the attributes of a tag, stopping at `>` or at the end of the line.
 *
 * Answers with where it stopped and the state to carry onto the next line: zero
 * once the tag is closed, otherwise the tag bit and, where the line ended inside
 * one, the quote its value is waiting on. The index is part of the answer
 * because only this scan knows which `>` ends the tag — one inside an attribute
 * value ends nothing.
 */
function scanAttributes(
  text: string,
  from: number,
  state: number,
  emit: (type: TokenType, start: number, end: number) => void,
  note: (event: Event) => void,
): { state: number; index: number } {
  const inTag = state & (IN_TAG | IN_DECLARATION)
  let i = from

  if ((state & IN_VALUE) !== 0) {
    const quote = (state & IN_VALUE_DOUBLE) !== 0 ? 34 : 39
    const end = text.indexOf(String.fromCharCode(quote))
    if (end === -1) {
      emit('string', 0, text.length)
      return { state, index: text.length }
    }
    emit('string', 0, end + 1)
    i = end + 1
  }

  while (i < text.length) {
    i = skipSpace(text, i)
    if (i >= text.length) break
    const code = text.charCodeAt(i)

    if (code === 62 /* > */) {
      emit('punctuation', i, i + 1)
      note({ kind: 'tagEnd', selfClosing: false })
      return { state: 0, index: i + 1 }
    }
    if (code === 47 && text.charCodeAt(i + 1) === 62 /* /> */) {
      emit('punctuation', i, i + 2)
      note({ kind: 'tagEnd', selfClosing: true })
      return { state: 0, index: i + 2 }
    }
    if (code === 63 && text.charCodeAt(i + 1) === 62 /* ?> */) {
      emit('punctuation', i, i + 2)
      note({ kind: 'tagEnd', selfClosing: true })
      return { state: 0, index: i + 2 }
    }
    if (code === 61 /* = */) {
      emit('punctuation', i, i + 1)
      i++
      continue
    }
    if (code === 34 || code === 39) {
      const end = text.indexOf(String.fromCharCode(code), i + 1)
      if (end === -1) {
        emit('string', i, text.length)
        return {
          state: inTag | (code === 34 ? IN_VALUE_DOUBLE : IN_VALUE_SINGLE),
          index: text.length,
        }
      }
      emit('string', i, end + 1)
      i = end + 1
      continue
    }

    const nameEnd = readName(text, i)
    if (nameEnd === i) {
      i++
      continue
    }
    emit('key', i, nameEnd)
    i = nameEnd
  }
  return { state: inTag, index: text.length }
}

interface Frame {
  readonly name: string
  readonly startLine: number
  readonly level: number
  count: number
  /** How many children of each name, so repeated siblings get an index. */
  readonly named: Map<string, number>
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
  const events: Event[] = []
  /** The element whose start tag is open: its name and the line it began on. */
  let pending: { name: string; line: number } | null = null
  let state = 0

  const report = (message: string, code: string, line: number) => {
    if (diagnostics.length >= MAX_REPORTED_ERRORS) return
    diagnostics.push({ severity: 'error', code, message, line })
  }

  /** Records what an element contributes to a path, and counts it in its parent. */
  const noteChild = (name: string, line: number): void => {
    const parent = stack[stack.length - 1]
    if (!parent) {
      if (segments[line] === undefined) segments[line] = pathSegmentOf([name])
      return
    }
    parent.count++
    const seen = parent.named.get(name) ?? 0
    parent.named.set(name, seen + 1)
    if (segments[line] !== undefined) return
    // The first `<item>` is `item`; the ones after it are `item[1]`, `item[2]`,
    // which is what a reader pasting a path into anything else expects.
    segments[line] = seen === 0 ? pathSegmentOf([name]) : pathSegmentOf([name, seen])
  }

  const close = (endLine: number): void => {
    const frame = stack.pop()
    if (!frame || ranges.length >= maxFoldRanges || endLine <= frame.startLine) return
    ranges.push({
      startLine: frame.startLine,
      endLine,
      level: frame.level,
      kind: 'element',
      summary: `<${frame.name}>`,
      childCount: frame.count,
    })
  }

  for (let line = 0; line < lines.length; line++) {
    states[line] = state
    events.length = 0
    state = scanLine(lines[line] ?? '', state, null, events)

    for (const event of events) {
      switch (event.kind) {
        case 'open':
          pending = { name: event.name, line }
          break
        case 'tagEnd': {
          if (!pending) break
          const open = pending
          pending = null
          noteChild(open.name, open.line)
          // A self-closing element opens nothing, so it has nothing to fold.
          if (event.selfClosing) break
          stack.push({
            name: open.name,
            startLine: open.line,
            level: stack.length,
            count: 0,
            named: new Map(),
          })
          break
        }
        case 'close': {
          let depth = -1
          for (let at = stack.length - 1; at >= 0; at--) {
            if (stack[at]?.name === event.name) {
              depth = at
              break
            }
          }
          if (depth === -1) {
            report(`Unexpected closing tag </${event.name}>`, 'xml-unexpected-close', line)
            break
          }
          // Everything the closing tag skipped past was never closed itself.
          if (depth < stack.length - 1) {
            report(`Unclosed <${stack[stack.length - 1]?.name}>`, 'xml-unclosed', line)
          }
          while (stack.length > depth) close(line)
          break
        }
        case 'unterminated':
          report(
            event.what === 'comment' ? 'Unterminated comment' : 'Unterminated CDATA section',
            `xml-unterminated-${event.what}`,
            line,
          )
          break
      }
    }
  }

  if (stack.length > 0) {
    report(`Unclosed <${stack[0]?.name}>`, 'xml-unclosed', stack[0]?.startLine ?? 0)
  }
  while (stack.length > 0) close(lines.length - 1)
  ranges.sort((a, b) => a.startLine - b.startLine || a.level - b.level)

  return { foldingRanges: ranges, diagnostics, lineStates: states, pathSegments: segments }
}

function tokenize(text: string, lineIndex: number, states: LineStates | undefined): Token[] {
  const tokens: Token[] = []
  scanLine(text, states?.[lineIndex] ?? 0, tokens, null)
  return tokens
}

/** Confidence that this is markup: a declaration, or tags that pair up. */
function detect(source: string, lines: readonly string[]): number {
  const head = source.trimStart()
  if (head.startsWith('<?xml') || head.startsWith('<!DOCTYPE')) return 0.95
  if (head.charCodeAt(0) !== 60 /* < */) return 0

  const scanned = Math.min(lines.length, 200)
  const events: Event[] = []
  let opens = 0
  let closes = 0
  let state = 0
  for (let i = 0; i < scanned; i++) {
    events.length = 0
    state = scanLine(lines[i] ?? '', state, null, events)
    for (const event of events) {
      if (event.kind === 'open') opens++
      else if (event.kind === 'close') closes++
    }
  }
  if (opens === 0) return 0
  // Tags that pair up are markup. One `<` on its own is a character, and half
  // the configuration languages there are use it for something else.
  return closes > 0 ? 0.85 : 0.3
}

/**
 * XML, and the markup that looks like it: elements fold, attributes highlight,
 * comments and CDATA carry across lines.
 *
 * Hand-written, with no dependency behind it, and forgiving by design: a
 * document with a tag nobody closed still folds everything around it and says
 * so in a diagnostic, because a configuration file being edited is unclosed
 * about half the time.
 */
export const xmlProvider: FormatProvider = {
  id: 'xml',
  displayName: 'XML',
  extensions: ['.xml', '.xsd', '.xsl', '.svg', '.plist', '.csproj', '.pom'],
  detect,
  analyze,
  tokenize,
}

registerFormat(xmlProvider)
