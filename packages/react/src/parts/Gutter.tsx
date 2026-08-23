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
    <svg viewBox="0 0 12 12" aria-hidden="true" focusable="false">
      <path
        d="M2.5 4.5 6 8l3.5-3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
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
        const range = lineIndex === null ? undefined : source.foldAt(lineIndex)
        const folded = range ? source.isFolded(range.startLine) : false
        return (
          <div
            key={item.key}
            className={`krona-row krona-row--${tone}`}
            style={{ transform: `translateY(${item.start}px)` }}
          >
            {showMarkers && MARKERS[tone] ? (
              <span className="krona-gutter-marker">{MARKERS[tone]}</span>
            ) : null}
            <span className="krona-gutter-number" style={{ minWidth: `${digits}ch` }}>
              {lineIndex === null ? '' : lineIndex + 1}
            </span>
            {range ? (
              <button
                type="button"
                className="krona-fold-toggle"
                aria-expanded={!folded}
                aria-label={folded ? labels.expandBlock : labels.collapseBlock}
                onClick={() => source.toggleFold(range.startLine)}
              >
                <Chevron />
              </button>
            ) : (
              <span className="krona-fold-spacer" />
            )}
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
