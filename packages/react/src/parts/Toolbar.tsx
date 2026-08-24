import { type CSSProperties, type ReactNode, useContext } from 'react'
import { useKronaConfig } from '../context/config'
import { DiffContext } from '../diff/DiffContext'
import { ViewerContext } from '../viewer/ViewerContext'

/** Props of `<Krona.Toolbar>`. */
export interface KronaToolbarProps {
  /** Show the expand-all / collapse-all buttons. Default true. */
  showFoldActions?: boolean
  /** Show added / removed / changed counts. Default true inside a diff. */
  showStats?: boolean
  className?: string
  style?: CSSProperties
  /** Extra content appended after the built-in controls. */
  children?: ReactNode
}

function ToolbarBase({
  showFoldActions = true,
  showStats = true,
  className,
  style,
  children,
}: KronaToolbarProps) {
  const config = useKronaConfig()
  const viewer = useContext(ViewerContext)
  const diff = useContext(DiffContext)
  const folding = viewer ?? diff
  const labels = viewer?.labels ?? diff?.labels ?? config.labels

  return (
    <div
      className={className ? `krona-toolbar ${className}` : 'krona-toolbar'}
      style={style}
      role="toolbar"
      aria-label={labels.document}
    >
      {showFoldActions && folding ? (
        <>
          <button type="button" onClick={folding.expandAll}>
            {labels.expandAll}
          </button>
          <button type="button" onClick={folding.collapseAll}>
            {labels.collapseAll}
          </button>
        </>
      ) : null}
      {showStats && diff ? (
        <>
          <span className="krona-stat krona-stat--added">
            {labels.added}: {diff.stats.added + diff.stats.changed}
          </span>
          <span className="krona-stat krona-stat--removed">
            {labels.removed}: {diff.stats.removed + diff.stats.changed}
          </span>
        </>
      ) : null}
      {children}
    </div>
  )
}

/**
 * `Krona.Toolbar` — fold actions plus, inside a diff, the change counts.
 *
 * The same component works in both modes; it simply shows fewer controls where
 * the others do not apply.
 *
 * @example
 * ```tsx
 * <Krona.Viewer source={text}>
 *   <Krona.Toolbar>
 *     <button onClick={download}>Download</button>
 *   </Krona.Toolbar>
 *   <Krona.Gutter />
 *   <Krona.Lines />
 * </Krona.Viewer>
 * ```
 */
export const Toolbar = Object.assign(ToolbarBase, { kronaSlot: 'chrome' as const })
