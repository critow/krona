import type { CollapsedRegion } from '@krona/core'
import { useLineSource } from '../context/lineSource'

/** Props of `<Krona.ExpandBar>`. */
export interface KronaExpandBarProps {
  /** Index of the hidden run this bar stands for. */
  regionIndex: number
  className?: string
}

/**
 * `Krona.ExpandBar` — the bar standing in for a hidden run of unchanged rows,
 * with the same up / down / all controls GitHub offers.
 *
 * Both panels paint the bar so it reads as one band across the diff, but only
 * the left copy is exposed to assistive technology and the keyboard — the right
 * one would just be a duplicate of the same three controls.
 */
export function ExpandBar({ regionIndex, className }: KronaExpandBarProps) {
  const source = useLineSource()
  const region = source.regions?.[regionIndex]
  if (!region || !source.expandContext) return null

  const interactive = source.side !== 'right'
  const hidden = hiddenRows(region)
  const step = source.step ?? 20
  const canStep = step < hidden

  return (
    <div
      className={className ? `krona-expand-bar ${className}` : 'krona-expand-bar'}
      {...(interactive ? {} : { 'aria-hidden': true })}
    >
      <span className="krona-expand-actions">
        {canStep ? (
          <>
            <button
              type="button"
              className="krona-expand-action"
              title={source.labels.expandUp}
              aria-label={source.labels.expandUp}
              tabIndex={interactive ? undefined : -1}
              onClick={() => source.expandContext?.(regionIndex, 'up')}
            >
              {'↑'}
            </button>
            <button
              type="button"
              className="krona-expand-action"
              title={source.labels.expandDown}
              aria-label={source.labels.expandDown}
              tabIndex={interactive ? undefined : -1}
              onClick={() => source.expandContext?.(regionIndex, 'down')}
            >
              {'↓'}
            </button>
          </>
        ) : null}
        <button
          type="button"
          className="krona-expand-action"
          title={source.labels.expandAllHidden}
          aria-label={source.labels.expandAllHidden}
          tabIndex={interactive ? undefined : -1}
          onClick={() => source.expandContext?.(regionIndex, 'all')}
        >
          {'⇅'}
        </button>
      </span>
      <span>{source.labels.hiddenLines(hidden)}</span>
    </div>
  )
}

function hiddenRows(region: CollapsedRegion): number {
  return region.endRow - region.startRow + 1
}
