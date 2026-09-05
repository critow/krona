import type { Span } from '../diff/intraline'
import { OffsetIndex } from '../model/lines'
import { defaultRegistry } from '../model/registry'
import type { DocumentModel, FormatRegistry, TextReplacement, TokenType } from '../model/types'

/**
 * A replacement of one span of the source text.
 *
 * Editing in Krona is editing text. An edit produces a new source string, which
 * is parsed into a new model; nothing mutates in place, and no JavaScript object
 * is ever built out of the document to be written back. That keeps the model an
 * immutable list of lines — the substrate folding and diffing share — and means
 * an edit can never invent syntax the format does not have, because it only ever
 * moves characters the user typed.
 */
export interface SourceEdit {
  /** Inclusive start offset in the source. */
  readonly start: number
  /** Exclusive end offset in the source. */
  readonly end: number
  /** Replacement text. Empty for a deletion. */
  readonly text: string
}

/** The result of applying an edit: the new source and the edit that undoes it. */
export interface EditResult {
  readonly source: string
  /** Applying this to {@link EditResult.source} restores the previous text. */
  readonly inverse: SourceEdit
}

/**
 * Applies one edit.
 *
 * The inverse comes back with it, so an undo stack can hold edits rather than
 * whole document snapshots — a hundred undo steps on a megabyte file cost a
 * hundred short strings instead of a hundred megabytes.
 *
 * @throws if the span lies outside the source or is inverted.
 */
export function applyEdit(source: string, edit: SourceEdit): EditResult {
  const { start, end, text } = edit
  // `NaN` compares false with everything, so a range check alone lets it
  // through and `slice` quietly rounds a fraction — either way the inverse
  // edit records coordinates that no longer undo anything.
  if (
    !Number.isInteger(start) ||
    !Number.isInteger(end) ||
    start < 0 ||
    end > source.length ||
    start > end
  ) {
    throw new RangeError(`Krona: edit span ${start}..${end} is outside the document.`)
  }
  return {
    source: source.slice(0, start) + text + source.slice(end),
    inverse: { start, end: start + text.length, text: source.slice(start, end) },
  }
}

const indexes = new WeakMap<DocumentModel, OffsetIndex>()

/** Line-start offsets for a model, computed once and cached against it. */
function indexOf(model: DocumentModel): OffsetIndex {
  let index = indexes.get(model)
  if (!index) {
    index = new OffsetIndex(model.source)
    indexes.set(model, index)
  }
  return index
}

/** Source offset where a line begins. */
export function offsetOfLine(model: DocumentModel, lineIndex: number): number {
  return indexOf(model).startOf(lineIndex)
}

/**
 * The line's text as a span of the source, without its terminator.
 *
 * Returns `undefined` for a line the document does not have.
 */
export function lineSpanAt(model: DocumentModel, lineIndex: number): Span | undefined {
  const line = model.lines[lineIndex]
  if (!line) return undefined
  const start = offsetOfLine(model, lineIndex)
  return { start, end: start + line.text.length }
}

/**
 * The whole folding block that opens on this line, as a span of the source —
 * or just the line, when it opens no block.
 */
export function blockSpanAt(model: DocumentModel, lineIndex: number): Span | undefined {
  const range = model.foldAt(lineIndex)
  if (!range) return lineSpanAt(model, lineIndex)
  const start = lineSpanAt(model, range.startLine)
  const end = lineSpanAt(model, range.endLine)
  if (!start || !end) return undefined
  return { start: start.start, end: end.end }
}

/** Token types that stand for a value a reader would edit. */
const VALUE_TOKENS: ReadonlySet<TokenType> = new Set<TokenType>([
  'string',
  'number',
  'boolean',
  'null',
])

/**
 * Every value on a line, as spans of the source, left to right.
 *
 * A line can hold more than one — `"timeouts": { "read": 30, "write": 30 }` has
 * two — so which one an edit means is the reader's choice to make by pointing at
 * it, not something to guess from the line.
 */
export function valueSpansAt(model: DocumentModel, lineIndex: number): readonly Span[] {
  const line = model.lines[lineIndex]
  if (!line) return []
  const start = offsetOfLine(model, lineIndex)
  const spans: Span[] = []
  for (const token of model.tokensAt(lineIndex)) {
    if (!VALUE_TOKENS.has(token.type)) continue
    spans.push({ start: start + token.start, end: start + token.end })
  }
  return spans
}

/**
 * An edit that removes the block opening on this line, or the line itself.
 *
 * The line terminator goes with it, so removing an entry does not leave a blank
 * line behind. A separator left dangling on the previous line — a JSON comma
 * before what is now the closing brace — is removed too, because the result has
 * to stay parseable: an edit that reliably produces a syntax error is not an
 * edit, it is a trap.
 */
export function removeBlockEdit(model: DocumentModel, lineIndex: number): SourceEdit | undefined {
  const span = blockSpanAt(model, lineIndex)
  if (!span) return undefined
  const source = model.source

  let end = span.end
  if (source.charCodeAt(end) === 13 /* \r */) end++
  if (source.charCodeAt(end) === 10 /* \n */) end++

  // Only when nothing but a closer follows: in the middle of a list the removed
  // entry took its own separator with it and the neighbours still line up.
  let start = span.start
  if (isLastEntry(source, end)) {
    let back = span.start - 1
    while (back >= 0 && isSpace(source.charCodeAt(back))) back--
    if (source.charCodeAt(back) === 44 /* , */) start = back
  }
  return { start, end, text: '' }
}

/** Where a duplicated entry landed, so a caller can open it for editing. */
export interface Duplication {
  readonly edit: SourceEdit
  /** First line of the copy in the document the edit produces. */
  readonly line: number
  /** Text of that line. */
  readonly text: string
}

/**
 * An edit that repeats the entry on this line — the whole block, when the line
 * opens one — directly below it.
 *
 * A copy is the one new entry that is guaranteed to be valid where it lands: it
 * is already an entry of this container, written in this format, at this
 * indentation. Krona knows nothing about what a new key should look like in
 * TOML versus YAML, and this way it does not have to; the reader edits the copy
 * into what they meant.
 *
 * The one thing the copy cannot inherit is a separator the original did not
 * need. Duplicating the last entry of a JSON object gives the original the comma
 * it now requires, and leaves the copy without one.
 */
export function duplicateBlockEdit(
  model: DocumentModel,
  lineIndex: number,
): Duplication | undefined {
  const span = blockSpanAt(model, lineIndex)
  if (!span) return undefined
  const source = model.source
  const entry = source.slice(span.start, span.end)
  const range = model.foldAt(lineIndex)
  const endLine = range ? range.endLine : lineIndex

  let after = span.end
  while (after < source.length && isBlank(source.charCodeAt(after))) after++
  const hasComma = source.charCodeAt(after) === 44 /* , */

  const eol = source.charCodeAt(span.end) === 13 ? '\r\n' : '\n'
  const start = hasComma ? after + 1 : span.end
  const text = hasComma
    ? `${eol}${entry},`
    : isLastEntry(source, span.end)
      ? `,${eol}${entry}`
      : `${eol}${entry}`

  const break_ = entry.search(/\r|\n/)
  return {
    edit: { start, end: start, text },
    line: endLine + 1,
    text: break_ === -1 ? entry : entry.slice(0, break_),
  }
}

/** Spaces and tabs, but not line breaks: a separator stays on its own line. */
function isBlank(code: number): boolean {
  return code === 32 || code === 9
}

function isSpace(code: number): boolean {
  return code === 32 || code === 9 || code === 10 || code === 13
}

/** True when only whitespace and a closing bracket follow `offset`. */
function isLastEntry(source: string, offset: number): boolean {
  for (let i = offset; i < source.length; i++) {
    const code = source.charCodeAt(i)
    if (isSpace(code)) continue
    return code === 125 /* } */ || code === 93 /* ] */
  }
  return true
}

/**
 * Moves an offset back over a line's indentation and the break before it.
 *
 * A formatter asked to shape a range takes the range's own column as the base
 * indentation. Text pasted flush against the left margin would then be laid out
 * relative to column zero and land a level short of where it belongs. Starting
 * the range one line break earlier shows the formatter which container the text
 * actually sits in. An edit that starts mid-line is left alone: there is no
 * indentation there to mislead anyone.
 */
function widenToLineBreak(source: string, offset: number): number {
  let start = offset
  while (start > 0) {
    const code = source.charCodeAt(start - 1)
    if (code !== 32 && code !== 9) break
    start--
  }
  if (source.charCodeAt(start - 1) === 10) start--
  if (source.charCodeAt(start - 1) === 13) start--
  return start
}

/**
 * The smallest single edit that turns `before` into `after`.
 *
 * Used to fold an edit and the formatting it triggered into one entry, so undo
 * reverses what the reader did rather than half of it.
 */
export function minimalEdit(before: string, after: string): SourceEdit {
  let prefix = 0
  const shortest = Math.min(before.length, after.length)
  while (prefix < shortest && before.charCodeAt(prefix) === after.charCodeAt(prefix)) prefix++

  let suffix = 0
  while (
    suffix < shortest - prefix &&
    before.charCodeAt(before.length - 1 - suffix) === after.charCodeAt(after.length - 1 - suffix)
  ) {
    suffix++
  }

  return {
    start: prefix,
    end: before.length - suffix,
    text: after.slice(prefix, after.length - suffix),
  }
}

/**
 * An edit with the format's own formatting already applied to what it inserted.
 *
 * Typing `{"a":1,"b":2}` into a block editor should leave a block written the
 * way the rest of the file is written, not one long line — but only the edited
 * span is touched, so the document around it keeps whatever shape it had, tidy
 * or not. Providers without a formatter give the edit back unchanged.
 *
 * `expand` decides whether line breaks may be added: false for a value edited
 * in place, where re-flowing the line would move text the reader was not
 * looking at.
 */
export function formattedEdit(
  model: DocumentModel,
  edit: SourceEdit,
  expand: boolean,
  registry: FormatRegistry = defaultRegistry,
): SourceEdit {
  const provider = registry.get(model.format)
  if (!provider?.format) return edit

  const applied = applyEdit(model.source, edit).source
  const span = { start: widenToLineBreak(applied, edit.start), end: edit.start + edit.text.length }
  // The one provider hook `parseDocument` does not call, and so the one that
  // does not get its guard there. A formatter that throws leaves the text as
  // the reader typed it, and a replacement pointing outside the document is
  // not applied: formatting is a convenience, never a reason to lose an edit.
  let replacements: readonly TextReplacement[]
  try {
    replacements = provider.format(applied, span, { expand })
  } catch {
    return edit
  }
  const usable = [...replacements]
    .filter(
      (replacement) =>
        Number.isInteger(replacement.start) &&
        Number.isInteger(replacement.end) &&
        replacement.start >= 0 &&
        replacement.end >= replacement.start &&
        replacement.end <= applied.length,
    )
    // Back to front, so an earlier replacement cannot move a later one.
    .sort((a, b) => b.start - a.start)
  let next = applied
  for (const replacement of usable) {
    next = next.slice(0, replacement.start) + replacement.text + next.slice(replacement.end)
  }
  return next === applied ? edit : minimalEdit(model.source, next)
}
