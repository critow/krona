import {
  blockSpanAt,
  type DocumentModel,
  duplicateBlockEdit,
  type EditHistory,
  emptyHistory,
  formattedEdit,
  type KronaLabels,
  lineSpanAt,
  offsetOfLine,
  removeBlockEdit,
  type SourceEdit,
  withEdit,
  withRedo,
  withUndo,
} from '@kronajs/core'
import { el } from './dom'

/** The span the reader has open, and what kind of thing it is. */
export interface EditTarget {
  readonly kind: 'value' | 'line' | 'block'
  readonly lineIndex: number
  /** Last line the editor covers; the same line except for a block. */
  readonly endLine: number
  readonly start: number
  readonly end: number
  readonly text: string
}

/** What the session asks of the element that owns it. */
export interface EditingHost {
  readonly labels: () => KronaLabels
  readonly model: () => DocumentModel
  readonly lineHeight: () => number
  /** The text changed: re-parse, repaint, and tell the page. */
  readonly changed: (source: string) => void
  /** Repaint without re-parsing: only the open editor moved. */
  readonly repaint: () => void
  /** A folded block would hide the very lines the editor is about to show. */
  readonly unfold: (startLine: number) => void
}

/**
 * Editing, and its undo history.
 *
 * Editing is text editing: each change replaces a span of the source and the
 * result is parsed again, so the model stays an immutable list of lines and no
 * JavaScript object is ever built out of the file to be written back.
 *
 * The history holds inverse edits rather than snapshots: undoing a hundred
 * changes to a megabyte file costs a hundred short strings rather than a
 * hundred megabytes, and every step is exact, because it is the very span that
 * changed.
 */
export class EditSession {
  #host: EditingHost
  #history: EditHistory
  #target: EditTarget | null = null

  constructor(host: EditingHost, source: string) {
    this.#host = host
    this.#history = emptyHistory(source)
  }

  get source(): string {
    return this.#history.source
  }

  get target(): EditTarget | null {
    return this.#target
  }

  get canUndo(): boolean {
    return this.#history.undo.length > 0
  }

  get canRedo(): boolean {
    return this.#history.redo.length > 0
  }

  /** Starts again from new text, dropping a history that describes another file. */
  reseed(source: string): void {
    if (source === this.#history.source) return
    this.#history = emptyHistory(source)
    this.#target = null
  }

  undo(): void {
    const next = withUndo(this.#history)
    // The transitions answer with the very history they were given when there
    // is nowhere to go, so a dead key press costs no repaint.
    if (next === this.#history) return
    this.#history = next
    this.#target = null
    this.#host.changed(next.source)
  }

  redo(): void {
    const next = withRedo(this.#history)
    if (next === this.#history) return
    this.#history = next
    this.#target = null
    this.#host.changed(next.source)
  }

  /** Opens one value, in place, so the line keeps reading as the line it is. */
  editValue(lineIndex: number, start: number, end: number): void {
    const text = this.#host.model().lines[lineIndex]?.text ?? ''
    this.#open({
      kind: 'value',
      lineIndex,
      endLine: lineIndex,
      start,
      end,
      text: text.slice(start, end),
    })
  }

  /** Opens one line as raw text. */
  editLine(lineIndex: number): void {
    const model = this.#host.model()
    if (!lineSpanAt(model, lineIndex)) return
    const text = model.lines[lineIndex]?.text ?? ''
    this.#open({ kind: 'line', lineIndex, endLine: lineIndex, start: 0, end: text.length, text })
  }

  /** Opens a whole block as raw text, unfolding it first if it is closed. */
  editBlock(lineIndex: number): void {
    const model = this.#host.model()
    const range = model.foldAt(lineIndex)
    const span = blockSpanAt(model, lineIndex)
    if (!span) return
    const endLine = range?.endLine ?? lineIndex
    const endText = model.lines[endLine]?.text ?? ''
    if (range) this.#host.unfold(range.startLine)
    this.#open({
      kind: 'block',
      lineIndex,
      endLine,
      start: 0,
      end: endText.length,
      text: this.#history.source.slice(span.start, span.end),
    })
  }

  /** Repeats an entry below itself and opens the copy: that is how a new one is made. */
  duplicate(lineIndex: number): void {
    const copy = duplicateBlockEdit(this.#host.model(), lineIndex)
    if (!copy) return
    this.#apply(copy.edit)
    this.#open({
      kind: 'line',
      lineIndex: copy.line,
      endLine: copy.line,
      start: 0,
      end: copy.text.length,
      text: copy.text,
    })
  }

  remove(lineIndex: number): void {
    const removal = removeBlockEdit(this.#host.model(), lineIndex)
    if (!removal) return
    this.#target = null
    this.#apply(removal)
  }

  cancel(): void {
    if (!this.#target) return
    this.#target = null
    this.#host.repaint()
  }

  commit(text: string): void {
    const target = this.#target
    this.#target = null
    if (!target) return
    const model = this.#host.model()
    const start = offsetOfLine(model, target.lineIndex) + target.start
    const end = offsetOfLine(model, target.endLine) + target.end
    if (text === this.#history.source.slice(start, end)) {
      this.#host.repaint()
      return
    }
    // A value edited in place keeps its line: re-flowing it would move text the
    // reader was not looking at. A line or block may be re-shaped.
    this.#apply(formattedEdit(model, { start, end, text }, target.kind !== 'value'))
  }

  #open(target: EditTarget): void {
    this.#target = target
    this.#host.repaint()
  }

  #apply(edit: SourceEdit): void {
    this.#history = withEdit(this.#history, edit)
    this.#host.changed(this.#history.source)
  }
}

/**
 * The open editor over one row.
 *
 * A value editor is an input sitting exactly where the value was. A line or
 * block editor is a textarea over the same span, because raw text is what those
 * two edit and a block is several lines of it.
 *
 * `Enter` commits a single-line edit and `Escape` cancels either, which is what
 * the reader's fingers already expect; in a textarea `Enter` inserts a line, so
 * committing there is `Ctrl`/`Cmd` + `Enter` or the button.
 */
export function editorFor(
  session: EditSession,
  target: EditTarget,
  labels: KronaLabels,
  lineHeight: number,
): HTMLElement[] {
  const multiline = target.kind !== 'value'
  let text = target.text

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      session.cancel()
      return
    }
    if (event.key !== 'Enter') return
    if (multiline && !(event.metaKey || event.ctrlKey)) return
    event.preventDefault()
    session.commit(text)
  }

  const action = (className: string, name: string, glyph: string, run: () => void) => {
    const button = el('button', className, glyph)
    button.type = 'button'
    button.dataset.tip = name
    button.setAttribute('aria-label', name)
    button.addEventListener('click', run)
    return button
  }
  const controls = el('span', 'krona-editor-actions', [
    action('krona-editor-save', labels.saveEdit, '✓', () => session.commit(text)),
    action('krona-editor-cancel', labels.cancelEdit, '✕', () => session.cancel()),
  ])

  if (!multiline) {
    const input = document.createElement('input')
    input.className = 'krona-editor-input'
    input.value = text
    input.size = Math.max(text.length, 1)
    input.setAttribute('aria-label', labels.editValue)
    input.addEventListener('input', () => {
      text = input.value
      input.size = Math.max(text.length, 1)
    })
    input.addEventListener('keydown', onKeyDown)
    queueMicrotask(() => {
      input.focus()
      input.select()
    })
    return [input, controls]
  }

  const area = document.createElement('textarea')
  area.className = 'krona-editor-area'
  area.value = text
  area.setAttribute('aria-label', target.kind === 'block' ? labels.editBlock : labels.editLine)
  area.addEventListener('input', () => {
    text = area.value
  })
  area.addEventListener('keydown', onKeyDown)
  queueMicrotask(() => {
    area.focus()
    area.select()
  })

  const block = el('span', 'krona-editor-block', [area, controls])
  block.style.height = `${(target.endLine - target.lineIndex + 1) * lineHeight}px`
  return [block]
}
