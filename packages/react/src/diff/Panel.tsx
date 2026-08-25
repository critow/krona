import type { AlignedRow, FoldRange } from '@krona/core'
import { useVirtualizer } from '@tanstack/react-virtual'
import { type CSSProperties, type ReactNode, useEffect, useMemo, useRef } from 'react'
import { LineSourceContext, type RenderRow, type RowTone } from '../context/lineSource'
import { splitSlots } from '../context/slots'
import { Gutter } from '../parts/Gutter'
import { Lines } from '../parts/Lines'
import { contentColumnsOf } from '../render/width'
import { usePanelLayout } from './PanelLayoutContext'

/** Props of `<Krona.Panel>`. */
export interface KronaPanelProps {
  /** Which version this panel shows. */
  side: 'left' | 'right'
  className?: string
  style?: CSSProperties
  /** Column parts. Defaults to a gutter and the lines. */
  children?: ReactNode
}

const TONE: Record<AlignedRow['kind'], RowTone> = {
  equal: 'normal',
  added: 'added',
  removed: 'removed',
  changed: 'changed',
}

function PanelBase({ side, className, style, children }: KronaPanelProps) {
  const layout = usePanelLayout()
  const isLeft = side === 'left'
  const model = isLeft ? layout.leftModel : layout.rightModel
  const rowOf = isLeft ? layout.rowIndex.leftRowOf : layout.rowIndex.rightRowOf

  const rows = useMemo<RenderRow[]>(
    () =>
      layout.displayItems.map((item) => {
        if (item.regionIndex !== undefined) {
          return { lineIndex: null, tone: 'spacer' as const, expandRegion: item.regionIndex }
        }
        const aligned = layout.alignedRows[item.rowIndex] as AlignedRow
        const lineIndex = isLeft ? aligned.left : aligned.right
        if (lineIndex === null) return { lineIndex: null, tone: 'spacer' as const }
        if (aligned.kind !== 'changed') {
          return { lineIndex, tone: TONE[aligned.kind] }
        }
        const intraline = layout.getIntraline(item.rowIndex)
        return {
          lineIndex,
          tone: 'changed' as const,
          intraline: isLeft ? intraline.left : intraline.right,
          wholeLine: intraline.wholeLine,
        }
      }),
    [layout, isLeft],
  )

  const scrollRef = useRef<HTMLDivElement | null>(null)
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => layout.lineHeight,
    overscan: layout.overscan,
  })

  useEffect(() => layout.scrollSync.register(scrollRef.current), [layout.scrollSync])

  const virtualItems = virtualizer.getVirtualItems()
  const totalSize = virtualizer.getTotalSize()

  // Both sides, not just this panel's: the panels must reserve the same width
  // for their horizontal scrolling to stay in step.
  const contentColumns = useMemo(
    () => contentColumnsOf(layout.leftModel, layout.rightModel),
    [layout.leftModel, layout.rightModel],
  )

  const lineSource = useMemo(
    () => ({
      side,
      model,
      rows,
      virtualizer,
      virtualItems,
      totalSize,
      scrollRef,
      labels: layout.labels,
      lineHeight: layout.lineHeight,
      maxLineNumber: model.lines.length,
      contentColumns,
      isFolded: (startLine: number) => layout.collapsedRows.has(rowOf[startLine] ?? -1),
      toggleFold: (startLine: number) => {
        const row = rowOf[startLine] ?? -1
        if (row >= 0) layout.toggleRowFold(row)
      },
      foldAt: (lineIndex: number): FoldRange | undefined => model.foldAt(lineIndex),
      expandContext: layout.expandContext,
      regions: layout.regions,
      step: layout.step,
    }),
    [side, model, rows, virtualizer, virtualItems, totalSize, contentColumns, layout, rowOf],
  )

  const slots = useMemo(() => (children ? splitSlots(children, 'canvas') : null), [children])
  const canvas = slots ? slots.canvas : [<Gutter key="gutter" />, <Lines key="lines" />]

  return (
    <LineSourceContext.Provider value={lineSource}>
      <section
        className={
          className
            ? `krona-panel krona-panel--${side} ${className}`
            : `krona-panel krona-panel--${side}`
        }
        style={style}
        aria-label={side === 'left' ? layout.labels.leftPanel : layout.labels.rightPanel}
      >
        <div className="krona-scroll" ref={scrollRef}>
          <div className="krona-canvas" style={{ height: `${totalSize}px` }}>
            {canvas}
          </div>
        </div>
      </section>
    </LineSourceContext.Provider>
  )
}

/**
 * `Krona.Panel` — one side of a diff. It provides the line source its parts
 * read, which is why `Krona.Gutter` and `Krona.Lines` are the very same
 * components used by `Krona.Viewer`.
 *
 * Folding a range inside a panel hides the matching rows in *both* panels: the
 * alignment maps the range's lines to row indices, and the panels render one
 * shared row list.
 */
export const Panel = Object.assign(PanelBase, { kronaSlot: 'panels' as const })
