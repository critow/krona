import type { AlignedRow, FoldRange } from '@krona/core'
import { useVirtualizer } from '@tanstack/react-virtual'
import { type CSSProperties, type ReactNode, useCallback, useEffect, useMemo, useRef } from 'react'
import { LineSourceContext, type RenderRow, type RowTone } from '../context/lineSource'
import { splitSlots } from '../context/slots'
import { Gutter } from '../parts/Gutter'
import { Lines } from '../parts/Lines'
import { contentColumnsOf } from '../render/width'
import { usePanelLayout } from './PanelLayoutContext'
import { unifiedEntries } from './unified'

/** Props of `<Krona.Unified>`. */
export interface KronaUnifiedProps {
  className?: string
  style?: CSSProperties
  /** Column parts. Defaults to a gutter and the lines. */
  children?: ReactNode
}

/**
 * How one row reads on its own.
 *
 * A changed pair arrives here as two rows, so each says what it is by itself:
 * the line that went, then the line that came. `changed` is a statement about
 * two lines sitting side by side, and there is no second column to sit beside.
 */
function toneOf(kind: AlignedRow['kind'], isLeft: boolean): RowTone {
  if (kind === 'equal') return 'normal'
  if (kind === 'changed') return isLeft ? 'removed' : 'added'
  return kind
}

function UnifiedBase({ className, style, children }: KronaUnifiedProps) {
  const layout = usePanelLayout()
  const { leftModel, rightModel, rowIndex } = layout

  const entries = useMemo(
    () => unifiedEntries(layout.displayItems, layout.alignedRows),
    [layout.displayItems, layout.alignedRows],
  )

  const rows = useMemo<RenderRow[]>(
    () =>
      entries.map((entry) => {
        if (entry.regionIndex !== undefined) {
          return { lineIndex: null, tone: 'spacer' as const, expandRegion: entry.regionIndex }
        }
        const aligned = layout.alignedRows[entry.rowIndex] as AlignedRow
        const isLeft = entry.side === 'left'
        const lineIndex = isLeft ? aligned.left : aligned.right
        if (lineIndex === null) return { lineIndex: null, tone: 'spacer' as const }
        const row: RenderRow = {
          lineIndex,
          tone: toneOf(aligned.kind, isLeft),
          model: isLeft ? leftModel : rightModel,
          side: isLeft ? 'left' : 'right',
        }
        if (aligned.kind !== 'changed') return row
        const intraline = layout.getIntraline(entry.rowIndex)
        return {
          ...row,
          intraline: isLeft ? intraline.left : intraline.right,
          wholeLine: intraline.wholeLine,
        }
      }),
    [entries, layout, leftModel, rightModel],
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

  // Both documents, as in a panel: the column is as wide as the wider version,
  // so a line does not change width when the view switches.
  const contentColumns = useMemo(
    () => contentColumnsOf(leftModel, rightModel),
    [leftModel, rightModel],
  )

  // Folding is keyed by aligned row, and a line index alone does not name a row
  // here: line 12 of the old file and line 12 of the new one are two lines.
  const rowFor = useCallback(
    (startLine: number, side?: 'left' | 'right') =>
      (side === 'left' ? rowIndex.leftRowOf : rowIndex.rightRowOf)[startLine] ?? -1,
    [rowIndex],
  )

  const lineSource = useMemo(
    () => ({
      side: 'unified' as const,
      // The right-hand version is the source's own document: it is the file the
      // reader still has, and the one an unchanged row is read from.
      model: rightModel,
      rows,
      virtualizer,
      virtualItems,
      totalSize,
      scrollRef,
      labels: layout.labels,
      lineHeight: layout.lineHeight,
      maxLineNumber: Math.max(leftModel.lines.length, rightModel.lines.length),
      contentColumns,
      isFolded: (startLine: number, side?: 'left' | 'right') =>
        layout.collapsedRows.has(rowFor(startLine, side)),
      toggleFold: (startLine: number, side?: 'left' | 'right') => {
        const row = rowFor(startLine, side)
        if (row >= 0) layout.toggleRowFold(row)
      },
      foldAt: (lineIndex: number, side?: 'left' | 'right'): FoldRange | undefined =>
        (side === 'left' ? leftModel : rightModel).foldAt(lineIndex),
      expandContext: layout.expandContext,
      regions: layout.regions,
      step: layout.step,
    }),
    [
      rows,
      virtualizer,
      virtualItems,
      totalSize,
      contentColumns,
      layout,
      leftModel,
      rightModel,
      rowFor,
    ],
  )

  const slots = useMemo(() => (children ? splitSlots(children, 'canvas') : null), [children])
  const canvas = slots ? slots.canvas : [<Gutter key="gutter" />, <Lines key="lines" />]

  return (
    <LineSourceContext.Provider value={lineSource}>
      <section
        className={
          className
            ? `krona-panel krona-panel--unified ${className}`
            : 'krona-panel krona-panel--unified'
        }
        style={style}
        aria-label={layout.labels.document}
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
 * `Krona.Unified` — both versions in one column, the way `git diff` prints one.
 *
 * A changed line appears twice, old above new; a line only one version has
 * appears once. It is the same alignment `Krona.Panel` renders, read as one
 * column instead of two, so folding, expanding and the row actions behave
 * exactly as they do side by side.
 *
 * `<Krona.Diff view="unified">` renders this instead of the two panels, and
 * `view="auto"` — the default — does so on a screen too narrow for two.
 */
export const Unified = Object.assign(UnifiedBase, { kronaSlot: 'panels' as const })
