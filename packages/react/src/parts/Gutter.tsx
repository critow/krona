import { type CSSProperties, memo } from 'react'
import { useLineSource } from '../context/lineSource'

/** Props shared by the column parts. */
export interface KronaGutterProps {
  /** Render the diff markers (`+` / `-`) column. Default true inside a diff. */
  showMarkers?: boolean
  className?: string
  style?: CSSProperties
}

function Chevron() {
  return (
    <svg className="krona-fold-chevron" viewBox="0 0 12 12" aria-hidden="true" focusable="false">
      <path
        d="M2.5 4.5 6 8l3.5-3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

const MARKERS = { added: '+', removed: '-', changed: '~', normal: '', spacer: '' } as const

/**
 * Line numbers and fold chevrons.
 *
 * The same component serves `Krona.Viewer` and either panel of `Krona.Diff`: it
 * reads whichever line source is nearest and never learns which mode it is in.
 *
 * @example
 * ```tsx
 * <Krona.Viewer source={text}>
 *   <Krona.Gutter />
 *   <Krona.Lines />
 * </Krona.Viewer>
 * ```
 */
const GutterBase = memo(function Gutter({
  showMarkers = true,
  className,
  style,
}: KronaGutterProps) {
  const source = useLineSource()
  const { labels, rows, totalSize, virtualItems } = source
  const digits = Math.max(2, String(source.maxLineNumber).length)

  return (
    <div
      className={className ? `krona-column krona-gutter ${className}` : 'krona-column krona-gutter'}
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
            />
          )
        }
        // `row.side` is set only in a unified diff, where the two versions
        // share one column and a line index alone does not name a line.
        const range = lineIndex === null ? undefined : source.foldAt(lineIndex, row.side)
        const folded = range ? source.isFolded(range.startLine, row.side) : false
        const body = (
          <>
            {showMarkers && MARKERS[tone] ? (
              <span className="krona-gutter-marker">{MARKERS[tone]}</span>
            ) : null}
            <span className="krona-gutter-number" style={{ minWidth: `${digits}ch` }}>
              {lineIndex === null ? '' : lineIndex + 1}
            </span>
            {range ? <Chevron /> : <span className="krona-fold-spacer" />}
          </>
        )
        const style = { transform: `translateY(${item.start}px)` }

        // A foldable line makes its whole gutter cell the control. A 16px
        // chevron between a line number and the code reads as punctuation, not
        // as something to click; the cell is a target you cannot miss, and
        // nothing else competes for a click in a read-only gutter.
        return range ? (
          <button
            key={item.key}
            type="button"
            className={`krona-row krona-row--${tone} krona-fold-toggle`}
            style={style}
            // Out of the tab order, but not out of the accessibility tree.
            // Tabbing chevron by chevron was never navigation — rows are
            // virtualized, so Tab could not reach the ones off screen anyway —
            // and the document is one tab stop now, walked with the arrows.
            // The control itself stays, for a pointer and for anyone who finds
            // it by any means other than Tab.
            tabIndex={-1}
            aria-expanded={!folded}
            aria-label={folded ? labels.expandBlock : labels.collapseBlock}
            title={folded ? labels.expandBlock : labels.collapseBlock}
            onClick={() => source.toggleFold(range.startLine, row.side)}
          >
            {body}
          </button>
        ) : (
          <div key={item.key} className={`krona-row krona-row--${tone}`} style={style}>
            {body}
          </div>
        )
      })}
    </div>
  )
})

/**
 * `Krona.Gutter` — line numbers, diff markers and fold chevrons.
 * Placed in the scrolling canvas automatically, wherever you write it.
 */
export const Gutter = Object.assign(GutterBase, { kronaSlot: 'canvas' as const })
