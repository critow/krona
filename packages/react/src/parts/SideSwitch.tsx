import { type CSSProperties, useContext } from 'react'
import { DiffContext } from '../diff/DiffContext'

/** Props of `<Krona.SideSwitch>`. */
export interface KronaSideSwitchProps {
  /** Render even where both panels are on screen. Default false. */
  always?: boolean
  className?: string
  style?: CSSProperties
}

function SideSwitchBase({ always = false, className, style }: KronaSideSwitchProps) {
  const diff = useContext(DiffContext)
  // Nothing to switch between in a unified diff: both versions are on screen,
  // one line above the other. `always` cannot bring back a choice that is gone.
  if (!diff || diff.unified || (!diff.narrow && !always)) return null

  const { labels, side, showSide } = diff
  return (
    // A fieldset rather than a labelled group: two buttons that pick one of two
    // things are a set of choices, and the element for that already exists.
    <fieldset
      className={className ? `krona-side-switch ${className}` : 'krona-side-switch'}
      style={style}
    >
      <legend className="krona-sr-only">{labels.document}</legend>
      <button type="button" aria-pressed={side === 'left'} onClick={() => showSide('left')}>
        {labels.leftPanel}
      </button>
      <button type="button" aria-pressed={side === 'right'} onClick={() => showSide('right')}>
        {labels.rightPanel}
      </button>
    </fieldset>
  )
}

/**
 * `Krona.SideSwitch` — chooses which version a narrow diff shows.
 *
 * Renders nothing where both panels fit, and nothing at all outside a diff, so
 * it can sit in a layout that serves both modes. `Krona.Toolbar` includes one;
 * the diff's default layout puts one above the panel when it needs it.
 */
export const SideSwitch = Object.assign(SideSwitchBase, { kronaSlot: 'chrome' as const })
