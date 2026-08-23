import { type CSSProperties, useCallback, useContext, useMemo } from 'react'
import { DiffContext } from '../diff/DiffContext'
import { PanelLayoutContext } from '../diff/PanelLayoutContext'

/** Props of `<Krona.Minimap>`. */
export interface KronaMinimapProps {
  className?: string
  style?: CSSProperties
}

/**
 * `Krona.Minimap` — a thin strip between the panels marking where the changes
 * are; clicking jumps both panels there.
 *
 * @throws if rendered outside `<Krona.Diff>`, since there is nothing to map.
 */
function MinimapBase({ className, style }: KronaMinimapProps) {
  const diff = useContext(DiffContext)
  const layout = useContext(PanelLayoutContext)
  if (!diff || !layout) {
    throw new Error('Krona: <Krona.Minimap> only makes sense inside <Krona.Diff>.')
  }

  const total = diff.alignedRows.length || 1
  const marks = useMemo(() => {
    const out: { top: number; height: number; kind: string }[] = []
    let index = 0
    while (index < diff.alignedRows.length) {
      const kind = diff.alignedRows[index]?.kind
      if (!kind || kind === 'equal') {
        index++
        continue
      }
      let end = index
      while (end + 1 < diff.alignedRows.length && diff.alignedRows[end + 1]?.kind === kind) end++
      out.push({
        top: (index / total) * 100,
        height: Math.max(((end - index + 1) / total) * 100, 0.4),
        kind,
      })
      index = end + 1
    }
    return out
  }, [diff.alignedRows, total])

  const jump = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const bounds = event.currentTarget.getBoundingClientRect()
      const ratio = (event.clientY - bounds.top) / bounds.height
      // Display items, not aligned rows: hidden rows take up no vertical space.
      const target = Math.round(ratio * layout.displayItems.length) * layout.lineHeight
      layout.scrollSync.scrollTo(Math.max(0, target - bounds.height / 2))
    },
    [layout],
  )

  return (
    <div
      className={className ? `krona-minimap ${className}` : 'krona-minimap'}
      style={style}
      role="button"
      tabIndex={0}
      aria-label={diff.labels.changeMap}
      onClick={jump}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') event.currentTarget.click()
      }}
    >
      {marks.map((mark) => (
        <span
          key={`${mark.kind}-${mark.top}`}
          className={`krona-minimap-mark krona-minimap-mark--${mark.kind}`}
          style={{ top: `${mark.top}%`, height: `${mark.height}%` }}
        />
      ))}
    </div>
  )
}

export const Minimap = Object.assign(MinimapBase, { kronaSlot: 'panels' as const })
