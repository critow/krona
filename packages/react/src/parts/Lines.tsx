import {
  blockSpanAt,
  buildSegments,
  type DocumentModel,
  type FoldKind,
  type FoldRange,
  nestingLevelAt,
  type Token,
  type TokenType,
  valueSpansAt,
} from '@kronajs/core'
import { type CSSProperties, Fragment, memo, type ReactNode, useState } from 'react'
import { type LineEditing, type LineSearch, useLineSource } from '../context/lineSource'
import { useRowNavigation } from '../hooks/useRowNavigation'
import type { KronaLabels } from '../labels'
import { ExpandBar } from './ExpandBar'
import { RowEditor } from './RowEditor'

/** Props of `<Krona.Lines>`. */
export interface KronaLinesProps {
  /**
   * Offer copy actions on the hovered row. Default true, in both modes —
   * copying is the one thing a read-only document is still for.
   */
  showCopyActions?: boolean
  className?: string
  style?: CSSProperties
}

/** Token types that stand for a value a reader would edit. */
const VALUE_TOKENS: ReadonlySet<TokenType> = new Set<TokenType>([
  'string',
  'number',
  'boolean',
  'null',
])

function renderSegments(
  text: string,
  tokens: readonly Token[],
  intraline: readonly { start: number; end: number }[] | undefined,
  wholeLine: boolean,
  labels: KronaLabels,
  onEditValue: ((start: number, end: number) => void) | undefined,
  matches?: readonly { start: number; end: number }[],
  current?: { start: number; end: number },
): ReactNode {
  const segments = buildSegments(text, tokens, intraline, wholeLine, matches, current)
  if (segments.length === 0) return text
  return segments.map((segment) => {
    const key = `${segment.start}-${segment.end}`
    if (segment.unsafe) {
      // Rendering the character itself would let bidi controls reorder the line
      // and zero-width characters vanish, making the view lie about the file.
      return (
        <span
          key={key}
          className="krona-unsafe"
          title={labels.unsafeCharacter(segment.unsafe.label)}
        >
          {segment.unsafe.label}
        </span>
      )
    }
    const classes: string[] = []
    if (segment.token) classes.push(`krona-token--${segment.token}`)
    if (segment.changed) classes.push('krona-intraline')
    if (segment.match) classes.push('krona-match')
    if (segment.match === 'current') classes.push('krona-match--current')
    const value = text.slice(segment.start, segment.end)
    if (onEditValue && segment.token !== undefined && VALUE_TOKENS.has(segment.token)) {
      classes.push('krona-value')
      // A real button, not a span with a handler: this is the only way to reach
      // a value from the keyboard, and it costs nothing visually — the styles
      // strip a button back to the text it wraps.
      return (
        <button
          key={key}
          type="button"
          className={classes.join(' ')}
          // A native title, not the styled tooltip: a bubble popping over every
          // value under the pointer is noise, and generated content joins the
          // accessible name, which here is the value itself. With text content
          // present a title becomes the description instead, so it stays clear
          // of the name.
          title={labels.editValue}
          onDoubleClick={() => onEditValue(segment.start, segment.end)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return
            event.preventDefault()
            onEditValue(segment.start, segment.end)
          }}
        >
          {value}
        </button>
      )
    }
    if (classes.length === 0) return <Fragment key={key}>{value}</Fragment>
    return (
      <span key={key} className={classes.join(' ')}>
        {value}
      </span>
    )
  })
}

/**
 * Brackets come from the range's kind rather than its `summary`, so a collapsed
 * block reads the way the format writes it — `{ 3 items }` for a mapping,
 * `[ 3 items ]` for a sequence — in every format, not just JSON.
 */
const BRACKETS: Record<FoldKind, readonly [string, string] | null> = {
  object: ['{', '}'],
  section: ['{', '}'],
  block: ['{', '}'],
  array: ['[', ']'],
  scalar: null,
}

function FoldPlaceholder({
  range,
  labels,
  onExpand,
}: {
  range: FoldRange
  labels: KronaLabels
  onExpand: () => void
}) {
  const hiddenLines = range.endLine - range.startLine
  const inside =
    range.childCount === undefined
      ? labels.foldedLines(hiddenLines)
      : labels.foldedItems(range.childCount)
  const brackets = BRACKETS[range.kind]
  return (
    <button
      type="button"
      className="krona-fold-placeholder"
      onClick={onExpand}
      title={labels.expandBlock}
    >
      {brackets ? `${brackets[0]} ${inside} ${brackets[1]}` : inside}
    </button>
  )
}

const PENCIL =
  'M2 10.6V13h2.4l6.9-6.9-2.4-2.4L2 10.6ZM12.8 4.6a.9.9 0 0 0 0-1.3l-1.1-1.1a.9.9 0 0 0-1.3 0l-1 1 2.4 2.4 1-1Z'
const BRACES =
  'M6 2.5H5A1.5 1.5 0 0 0 3.5 4v2.2c0 .7-.6 1.3-1.3 1.3.7 0 1.3.6 1.3 1.3V11A1.5 1.5 0 0 0 5 12.5h1M10 2.5h1A1.5 1.5 0 0 1 12.5 4v2.2c0 .7.6 1.3 1.3 1.3-.7 0-1.3.6-1.3 1.3V11a1.5 1.5 0 0 1-1.5 1.5h-1'
const TRASH = 'M2.5 4h11M6 4V2.6h4V4M4.2 4l.5 9.4h6.6L11.8 4M6.6 6.4v4.6M9.4 6.4v4.6'
const PLUS = 'M8 3.2v9.6M3.2 8h9.6'
const COPY =
  'M5.5 5.5V3.2c0-.4.3-.7.7-.7h6.6c.4 0 .7.3.7.7v6.6c0 .4-.3.7-.7.7h-2.3M3.2 5.5h6.6c.4 0 .7.3.7.7v6.6c0 .4-.3.7-.7.7H3.2a.7.7 0 0 1-.7-.7V6.2c0-.4.3-.7.7-.7Z'
const TICK = 'M3 8.5 6.4 12 13 4.6'
// A chain of two links, which is what every anchor in every document reader
// looks like; the path is the copy-path icon's shape at a different angle.
const LINK =
  'M6.7 9.3a2.4 2.4 0 0 0 3.6.3l2.2-2.2a2.4 2.4 0 0 0-3.4-3.4L8 5.1M9.3 6.7a2.4 2.4 0 0 0-3.6-.3L3.5 8.6a2.4 2.4 0 0 0 3.4 3.4L8 10.9'
const PATH =
  'M6.2 9.8a2.6 2.6 0 0 0 3.9.3l2.4-2.4a2.6 2.6 0 0 0-3.7-3.7l-1.4 1.4M9.8 6.2a2.6 2.6 0 0 0-3.9-.3L3.5 8.3a2.6 2.6 0 0 0 3.7 3.7l1.4-1.4'

function Icon({ path, filled }: { path: string; filled?: boolean }) {
  return (
    <svg
      className="krona-action-icon"
      viewBox="0 0 16 16"
      width="12"
      height="12"
      fill={filled ? 'currentColor' : 'none'}
      stroke={filled ? 'none' : 'currentColor'}
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={path} />
    </svg>
  )
}

/**
 * Copies text, reporting whether it worked.
 *
 * The Clipboard API needs a secure context and a permission, and refuses
 * outright in some embeddings; a copy button that silently claims success is
 * worse than one that stays quiet.
 */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

function RowActions({
  lineIndex,
  range,
  model,
  editing,
  labels,
  showCopy,
  selectLine,
}: {
  lineIndex: number
  range: FoldRange | undefined
  model: DocumentModel
  editing: LineEditing | undefined
  labels: KronaLabels
  showCopy: boolean
  selectLine?: (lineIndex: number) => void
}) {
  const [copied, setCopied] = useState<'entry' | 'value' | 'path' | null>(null)

  const copy = (what: 'entry' | 'value' | 'path', text: string) => {
    void copyText(text).then((ok) => {
      if (!ok) return
      setCopied(what)
      setTimeout(() => setCopied(null), 1400)
    })
  }

  const values = showCopy ? valueSpansAt(model, lineIndex) : []
  const only = values.length === 1 ? values[0] : undefined
  const block = showCopy ? blockSpanAt(model, lineIndex) : undefined
  const path = showCopy ? model.pathAt(lineIndex) : undefined

  return (
    <span className="krona-row-actions">
      {/* The tooltip is a pseudo-element, which a screen reader never sees, and
          the button's own name must not change under the pointer. */}
      <span role="status" className="krona-sr-only">
        {copied ? labels.copied : ''}
      </span>
      {selectLine ? (
        <button
          type="button"
          data-tip={labels.linkToLine}
          aria-label={labels.linkToLine}
          onClick={() => selectLine(lineIndex)}
        >
          <Icon path={LINK} />
        </button>
      ) : null}
      {only ? (
        <button
          type="button"
          className={copied === 'value' ? 'krona-action--confirmed' : undefined}
          data-tip={copied === 'value' ? labels.copied : labels.copyValue}
          aria-label={labels.copyValue}
          onClick={() => copy('value', model.source.slice(only.start, only.end))}
        >
          <Icon path={copied === 'value' ? TICK : COPY} />
        </button>
      ) : null}
      {path ? (
        <button
          type="button"
          className={copied === 'path' ? 'krona-action--confirmed' : undefined}
          data-tip={copied === 'path' ? labels.copied : `${labels.copyPath}: ${path}`}
          aria-label={labels.copyPath}
          onClick={() => copy('path', path)}
        >
          <Icon path={copied === 'path' ? TICK : PATH} />
        </button>
      ) : null}
      {block ? (
        <button
          type="button"
          className={copied === 'entry' ? 'krona-action--confirmed' : undefined}
          data-tip={copied === 'entry' ? labels.copied : labels.copyEntry}
          aria-label={labels.copyEntry}
          onClick={() => copy('entry', model.source.slice(block.start, block.end))}
        >
          <Icon path={copied === 'entry' ? TICK : COPY} filled={copied !== 'entry'} />
        </button>
      ) : null}
      {editing ? (
        <>
          <button
            type="button"
            data-tip={labels.editLine}
            aria-label={labels.editLine}
            onClick={() => editing.editLine(lineIndex)}
          >
            <Icon path={PENCIL} filled />
          </button>
          {range ? (
            <button
              type="button"
              data-tip={labels.editBlock}
              aria-label={labels.editBlock}
              onClick={() => editing.editBlock(lineIndex)}
            >
              <Icon path={BRACES} />
            </button>
          ) : null}
          <button
            type="button"
            data-tip={labels.duplicateEntry}
            aria-label={labels.duplicateEntry}
            onClick={() => editing.duplicate(lineIndex)}
          >
            <Icon path={PLUS} />
          </button>
          <button
            type="button"
            className="krona-action--danger"
            data-tip={labels.deleteEntry}
            aria-label={labels.deleteEntry}
            onClick={() => editing.remove(lineIndex)}
          >
            <Icon path={TRASH} />
          </button>
        </>
      ) : null}
    </span>
  )
}

/**
 * The current match, but only where it actually is.
 *
 * A line can carry several matches and the same line number exists in both
 * versions of a diff, so the row has to agree on the side as well.
 */
function currentOn(
  search: LineSearch | undefined,
  lineIndex: number,
  side: 'left' | 'right' | undefined,
): { start: number; end: number } | undefined {
  const current = search?.current
  if (!current || current.lineIndex !== lineIndex) return undefined
  if (side && current.side !== side) return undefined
  return current
}

const LinesBase = memo(function Lines({
  showCopyActions = true,
  className,
  style,
}: KronaLinesProps) {
  const source = useLineSource()
  const { editing, labels, lineHeight, model, rows, search, totalSize, virtualItems } = source
  const target = editing?.target ?? null
  const nav = useRowNavigation(source)

  // A textarea is taller than the row it starts on, and `.krona-row` contains
  // its own painting, so an overlay editor has to be a sibling of the rows
  // rather than a child of one.
  const overlay =
    target && target.kind !== 'value'
      ? virtualItems.find((item) => rows[item.index]?.lineIndex === target.lineIndex)
      : undefined

  return (
    <div
      ref={nav.containerRef}
      // A document is a tree whose nesting lives in the folding ranges rather
      // than in the markup, so every row states its own depth.
      role="tree"
      aria-label={labels.document}
      onKeyDown={nav.onKeyDown}
      onFocus={nav.onFocus}
      onBlur={nav.onBlur}
      className={
        className
          ? `krona-column krona-column--lines krona-lines ${className}`
          : 'krona-column krona-column--lines krona-lines'
      }
      style={{ height: `${totalSize}px`, ...style }}
    >
      {/* Reserves the document's full width. Rows are absolutely positioned, so
          they give this column no intrinsic width of their own, and the
          horizontal scroll extent would otherwise be whatever the handful of
          rows on screen happen to need. */}
      <div
        className="krona-width-strut"
        style={{ width: `${source.contentColumns}ch` }}
        aria-hidden="true"
      />
      {virtualItems.map((item) => {
        const row = rows[item.index]
        if (!row) return null
        const { lineIndex, tone } = row
        if (row.expandRegion !== undefined) {
          return (
            <div
              key={item.key}
              className="krona-row krona-row--expand"
              style={{ transform: `translateY(${item.start}px)` }}
              data-index={item.index}
              role="treeitem"
              tabIndex={item.index === nav.active ? 0 : -1}
              aria-level={1}
              aria-posinset={item.index + 1}
              aria-setsize={rows.length}
            >
              <ExpandBar regionIndex={row.expandRegion} />
            </div>
          )
        }
        if (lineIndex === null) {
          return (
            <div
              key={item.key}
              className="krona-row krona-row--spacer"
              style={{ transform: `translateY(${item.start}px)` }}
              // The blank half of a changed pair. There is no line here, so
              // there is nothing for a reader to be told about.
              aria-hidden="true"
            />
          )
        }
        // In a unified diff consecutive rows come from the two versions, so a
        // row names its own document; everywhere else there is only one.
        const rowModel = row.model ?? model
        const text = rowModel.lines[lineIndex]?.text ?? ''
        const range = source.foldAt(lineIndex, row.side)
        const folded = range ? source.isFolded(range.startLine, row.side) : false
        const valueOpen = target?.kind === 'value' && target.lineIndex === lineIndex
        return (
          <div
            key={item.key}
            className={`krona-row krona-row--${tone}${
              editing || showCopyActions ? ' krona-row--actionable' : ''
            }${lineIndex === source.selectedLine ? ' krona-row--selected' : ''}`}
            style={{ transform: `translateY(${item.start}px)` }}
            data-line={lineIndex + 1}
            data-index={item.index}
            role="treeitem"
            tabIndex={item.index === nav.active ? 0 : -1}
            aria-level={nestingLevelAt(rowModel, lineIndex)}
            aria-posinset={item.index + 1}
            aria-setsize={rows.length}
            {...(range ? { 'aria-expanded': !folded } : {})}
          >
            {valueOpen && editing ? (
              <>
                {text.slice(0, target.start)}
                <RowEditor
                  target={target}
                  editing={editing}
                  labels={labels}
                  lineHeight={lineHeight}
                />
                {text.slice(target.end)}
              </>
            ) : (
              renderSegments(
                text,
                rowModel.tokensAt(lineIndex),
                row.intraline,
                row.wholeLine ?? false,
                labels,
                editing ? (start, end) => editing.editValue(lineIndex, start, end) : undefined,
                search?.matchesAt(lineIndex, row.side),
                currentOn(search, lineIndex, row.side),
              )
            )}
            {folded && range ? (
              <FoldPlaceholder
                range={range}
                labels={labels}
                onExpand={() => source.toggleFold(range.startLine, row.side)}
              />
            ) : null}
            {(editing || showCopyActions || source.selectLine) && !valueOpen ? (
              <RowActions
                lineIndex={lineIndex}
                range={range}
                model={rowModel}
                editing={editing}
                labels={labels}
                showCopy={showCopyActions}
                {...(source.selectLine ? { selectLine: source.selectLine } : {})}
              />
            ) : null}
          </div>
        )
      })}
      {overlay && target && editing ? (
        <div className="krona-row-overlay" style={{ transform: `translateY(${overlay.start}px)` }}>
          <RowEditor target={target} editing={editing} labels={labels} lineHeight={lineHeight} />
        </div>
      ) : null}
    </div>
  )
})

/**
 * `Krona.Lines` — the document text: syntax tokens, word-level diff highlights
 * and collapsed-block placeholders.
 *
 * Where the mode allows editing, each row also carries its actions and hosts the
 * open editor. Content is emitted as React text nodes only. There is no
 * `innerHTML` anywhere in Krona, so a configuration file can never become markup.
 */
export const Lines = Object.assign(LinesBase, { kronaSlot: 'canvas' as const })
