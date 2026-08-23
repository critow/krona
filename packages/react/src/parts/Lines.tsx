import type { FoldRange, Token } from '@krona/core'
import { type CSSProperties, Fragment, memo, type ReactNode } from 'react'
import { useLineSource } from '../context/lineSource'
import type { KronaLabels } from '../labels'
import { buildSegments } from '../render/segments'
import { ExpandBar } from './ExpandBar'

/** Props of `<Krona.Lines>`. */
export interface KronaLinesProps {
  className?: string
  style?: CSSProperties
}

function renderSegments(
  text: string,
  tokens: readonly Token[],
  intraline: readonly { start: number; end: number }[] | undefined,
  wholeLine: boolean,
  labels: KronaLabels,
): ReactNode {
  const segments = buildSegments(text, tokens, intraline, wholeLine)
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
    const value = text.slice(segment.start, segment.end)
    if (classes.length === 0) return <Fragment key={key}>{value}</Fragment>
    return (
      <span key={key} className={classes.join(' ')}>
        {value}
      </span>
    )
  })
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
  const hidden = range.endLine - range.startLine
  return (
    <button type="button" className="krona-fold-placeholder" onClick={onExpand}>
      {range.summary ? `${range.summary} ` : ''}
      {labels.foldedLines(hidden)}
    </button>
  )
}

const LinesBase = memo(function Lines({ className, style }: KronaLinesProps) {
  const source = useLineSource()
  const { labels, model, rows, totalSize, virtualItems } = source

  return (
    <div
      className={
        className
          ? `krona-column krona-column--lines krona-lines ${className}`
          : 'krona-column krona-column--lines krona-lines'
      }
      style={{ height: `${totalSize}px`, ...style }}
    >
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
            />
          )
        }
        const text = model.lines[lineIndex]?.text ?? ''
        const range = source.foldAt(lineIndex)
        const folded = range ? source.isFolded(range.startLine) : false
        return (
          <div
            key={item.key}
            className={`krona-row krona-row--${tone}`}
            style={{ transform: `translateY(${item.start}px)` }}
            data-line={lineIndex + 1}
          >
            {renderSegments(
              text,
              model.tokensAt(lineIndex),
              row.intraline,
              row.wholeLine ?? false,
              labels,
            )}
            {folded && range ? (
              <FoldPlaceholder
                range={range}
                labels={labels}
                onExpand={() => source.toggleFold(range.startLine)}
              />
            ) : null}
          </div>
        )
      })}
    </div>
  )
})

/**
 * `Krona.Lines` — the document text: syntax tokens, word-level diff highlights
 * and collapsed-block placeholders.
 *
 * Content is emitted as React text nodes only. There is no `innerHTML` anywhere
 * in Krona, so a configuration file can never become markup.
 */
export const Lines = Object.assign(LinesBase, { kronaSlot: 'canvas' as const })
