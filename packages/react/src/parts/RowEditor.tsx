import { type KeyboardEvent, useEffect, useRef, useState } from 'react'
import type { EditTarget, LineEditing } from '../context/lineSource'
import type { KronaLabels } from '../labels'

/**
 * The open editor over one row.
 *
 * A value editor is an input sitting exactly where the value was, so the line
 * keeps reading as the line it is. A line or block editor is a textarea over the
 * same span, because raw text is what those two edit and a block is several
 * lines of it.
 *
 * `Enter` commits a single-line edit and `Escape` cancels either, which is what
 * the reader's fingers already expect; in a textarea `Enter` inserts a line, so
 * committing there is `Ctrl`/`Cmd` + `Enter` or the button.
 */
export function RowEditor({
  target,
  editing,
  labels,
  lineHeight,
}: {
  target: EditTarget
  editing: LineEditing
  labels: KronaLabels
  lineHeight: number
}) {
  const [text, setText] = useState(target.text)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const areaRef = useRef<HTMLTextAreaElement | null>(null)
  const multiline = target.kind !== 'value'

  useEffect(() => {
    const element = multiline ? areaRef.current : inputRef.current
    element?.focus()
    element?.select()
  }, [multiline])

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      editing.cancel()
      return
    }
    if (event.key !== 'Enter') return
    if (multiline && !(event.metaKey || event.ctrlKey)) return
    event.preventDefault()
    editing.commit(text)
  }

  const controls = (
    <span className="krona-editor-actions">
      <button
        type="button"
        className="krona-editor-save"
        data-tip={labels.saveEdit}
        aria-label={labels.saveEdit}
        onClick={() => editing.commit(text)}
      >
        ✓
      </button>
      <button
        type="button"
        className="krona-editor-cancel"
        data-tip={labels.cancelEdit}
        aria-label={labels.cancelEdit}
        onClick={editing.cancel}
      >
        ✕
      </button>
    </span>
  )

  if (!multiline) {
    return (
      <>
        <input
          ref={inputRef}
          className="krona-editor-input"
          value={text}
          size={Math.max(text.length, 1)}
          aria-label={labels.editValue}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={onKeyDown}
        />
        {controls}
      </>
    )
  }

  const rowCount = target.endLine - target.lineIndex + 1
  return (
    <span className="krona-editor-block" style={{ height: `${rowCount * lineHeight}px` }}>
      <textarea
        ref={areaRef}
        className="krona-editor-area"
        value={text}
        aria-label={target.kind === 'block' ? labels.editBlock : labels.editLine}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={onKeyDown}
      />
      {controls}
    </span>
  )
}
