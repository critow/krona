import {
  alignDiff,
  type CollapsedRegion,
  collapseUnchanged,
  type DocumentModel,
  diffLines,
  type ExpandDirection,
  type Format,
  type IntralineResult,
  intralineDiff,
} from '@krona/core'
import { type CSSProperties, type ReactNode, useCallback, useMemo, useRef, useState } from 'react'
import { useKronaConfig } from '../context/config'
import { splitSlots } from '../context/slots'
import { useDocument } from '../hooks/useDocument'
import { useScrollSync } from '../hooks/useScrollSync'
import { type KronaLabels, resolveLabels } from '../labels'
import { Minimap } from '../parts/Minimap'
import { DiffContext } from './DiffContext'
import { Panel } from './Panel'
import { PanelLayoutContext } from './PanelLayoutContext'
import { buildRowIndex, hasFoldAt, useDisplayItems } from './rows'

/** How much of an unchanged run stays visible around a change. */
export interface CollapseUnchangedOptions {
  /** Unchanged rows kept on each side of a change. Default 3. */
  context?: number
  /** Shortest run worth hiding. Default 10. */
  minimumHidden?: number
  /** Rows revealed by one click of the up / down controls. Default 20. */
  step?: number
}

/** Props of `<Krona.Diff>`. */
export interface KronaDiffProps {
  /** Previous version. Provide this or {@link KronaDiffProps.leftModel}. */
  left?: string
  /** Current version. Provide this or {@link KronaDiffProps.rightModel}. */
  right?: string
  /** A previously parsed model for the left side, e.g. produced in a Worker. */
  leftModel?: DocumentModel
  /** A previously parsed model for the right side. */
  rightModel?: DocumentModel
  /** Overrides the format from the enclosing `<Krona>`. */
  format?: Format
  /** Overrides the labels from the enclosing `<Krona>`. */
  labels?: Partial<KronaLabels>
  /** Hide long runs of unchanged lines behind an expandable bar. */
  collapseUnchanged?: boolean | CollapseUnchangedOptions
  /** Collapse folding ranges at this depth or deeper on load. */
  defaultCollapsedDepth?: number
  /** Compare lines ignoring trailing whitespace. Default false. */
  ignoreTrailingWhitespace?: boolean
  /** Show the change minimap between the panels. Default false. */
  showMinimap?: boolean
  /** Extra rows rendered outside the viewport. Default 8. */
  overscan?: number
  className?: string
  style?: CSSProperties
  /** Custom layout. Without children the diff renders two default panels. */
  children?: ReactNode
}

const NO_INTRALINE: IntralineResult = { left: [], right: [], wholeLine: false }

/**
 * Side-by-side diff of two versions of a file.
 *
 * The comparison is textual, like git: reordering keys or reindenting a block
 * is a real difference and is shown as one.
 *
 * @example
 * ```tsx
 * <Krona format="json">
 *   <Krona.Diff left={before} right={after} collapseUnchanged />
 * </Krona>
 * ```
 */
export function KronaDiff({
  left,
  right,
  leftModel: providedLeft,
  rightModel: providedRight,
  format,
  labels,
  collapseUnchanged: collapse = false,
  defaultCollapsedDepth,
  ignoreTrailingWhitespace = false,
  showMinimap = false,
  overscan = 8,
  className,
  style,
  children,
}: KronaDiffProps) {
  const config = useKronaConfig()
  const activeFormat = format ?? config.format
  const leftModel = useDocument(left, providedLeft, activeFormat, config.limits, config.providers)
  const rightModel = useDocument(
    right,
    providedRight,
    activeFormat,
    config.limits,
    config.providers,
  )

  const resolvedLabels = useMemo(
    () => (labels ? resolveLabels({ ...config.labels, ...labels }, config.locale) : config.labels),
    [labels, config.labels, config.locale],
  )

  const aligned = useMemo(
    () => alignDiff(diffLines(leftModel.source, rightModel.source, { ignoreTrailingWhitespace })),
    [leftModel.source, rightModel.source, ignoreTrailingWhitespace],
  )

  const rowIndex = useMemo(
    () => buildRowIndex(aligned.rows, leftModel, rightModel),
    [aligned.rows, leftModel, rightModel],
  )

  const collapseOptions = useMemo<CollapseUnchangedOptions | null>(() => {
    if (!collapse) return null
    return collapse === true ? {} : collapse
  }, [collapse])

  // Rows that open a folding range must survive the unchanged-run collapse:
  // hiding one takes its chevron with it, and a file whose only foldable line
  // sits in an unchanged run would offer nothing to fold.
  const foldStartRows = useMemo(() => {
    const rows = new Set<number>()
    for (let row = 0; row < aligned.rows.length; row++) {
      if (hasFoldAt(row, aligned.rows, leftModel, rightModel)) rows.add(row)
    }
    return rows
  }, [aligned.rows, leftModel, rightModel])

  const initialRegions = useMemo<(CollapsedRegion | null)[]>(() => {
    if (!collapseOptions) return []
    return collapseUnchanged(aligned.rows, {
      keepRows: foldStartRows,
      ...(collapseOptions.context !== undefined ? { context: collapseOptions.context } : {}),
      ...(collapseOptions.minimumHidden !== undefined
        ? { minimumHidden: collapseOptions.minimumHidden }
        : {}),
    })
  }, [aligned.rows, collapseOptions, foldStartRows])

  const [regions, setRegions] = useState(initialRegions)
  const lastInitial = useRef(initialRegions)
  if (lastInitial.current !== initialRegions) {
    lastInitial.current = initialRegions
    setRegions(initialRegions)
  }

  const initialCollapsedRows = useMemo(() => {
    const collapsed = new Set<number>()
    if (defaultCollapsedDepth === undefined) return collapsed
    for (const range of leftModel.foldingRanges) {
      if (range.level < defaultCollapsedDepth) continue
      const row = rowIndex.leftRowOf[range.startLine] ?? -1
      if (row >= 0) collapsed.add(row)
    }
    for (const range of rightModel.foldingRanges) {
      if (range.level < defaultCollapsedDepth) continue
      const row = rowIndex.rightRowOf[range.startLine] ?? -1
      if (row >= 0) collapsed.add(row)
    }
    return collapsed
  }, [defaultCollapsedDepth, leftModel, rightModel, rowIndex])

  const [collapsedRows, setCollapsedRows] = useState(initialCollapsedRows)
  const lastCollapsedSeed = useRef(initialCollapsedRows)
  if (lastCollapsedSeed.current !== initialCollapsedRows) {
    lastCollapsedSeed.current = initialCollapsedRows
    setCollapsedRows(initialCollapsedRows)
  }

  const displayItems = useDisplayItems(
    aligned.rows,
    leftModel,
    rightModel,
    rowIndex,
    collapsedRows,
    regions,
  )

  // Word-level diffs are computed for the rows a panel actually paints and kept
  // in a cache keyed by row, so a large diff costs only what is on screen.
  const intralineCache = useRef(new Map<number, IntralineResult>())
  const cacheKey = useRef(aligned.rows)
  if (cacheKey.current !== aligned.rows) {
    cacheKey.current = aligned.rows
    intralineCache.current = new Map()
  }

  const getIntraline = useCallback(
    (row: number): IntralineResult => {
      const cached = intralineCache.current.get(row)
      if (cached) return cached
      const aligning = aligned.rows[row]
      if (aligning?.kind !== 'changed') return NO_INTRALINE
      if (aligning.left === null || aligning.right === null) return NO_INTRALINE
      const result = intralineDiff(
        leftModel.lines[aligning.left]?.text ?? '',
        rightModel.lines[aligning.right]?.text ?? '',
      )
      intralineCache.current.set(row, result)
      return result
    },
    [aligned.rows, leftModel, rightModel],
  )

  const expandContext = useCallback(
    (regionIndex: number, direction: ExpandDirection, step?: number) => {
      setRegions((current) => {
        const region = current[regionIndex]
        if (!region) return current
        const next = [...current]
        const resolvedStep = step ?? collapseOptions?.step ?? 20
        next[regionIndex] = expandOne(region, direction, resolvedStep)
        return next
      })
    },
    [collapseOptions],
  )

  const toggleRowFold = useCallback((row: number) => {
    setCollapsedRows((current) => {
      const next = new Set(current)
      if (!next.delete(row)) next.add(row)
      return next
    })
  }, [])

  const expandAll = useCallback(() => {
    setCollapsedRows((current) => (current.size === 0 ? current : new Set()))
    setRegions((current) => (current.length === 0 ? current : current.map(() => null)))
  }, [])

  const collapseAll = useCallback(() => {
    const collapsed = new Set<number>()
    for (const range of leftModel.foldingRanges) {
      const row = rowIndex.leftRowOf[range.startLine] ?? -1
      if (row >= 0) collapsed.add(row)
    }
    for (const range of rightModel.foldingRanges) {
      const row = rowIndex.rightRowOf[range.startLine] ?? -1
      if (row >= 0) collapsed.add(row)
    }
    setCollapsedRows(collapsed)
  }, [leftModel, rightModel, rowIndex])

  const scrollSync = useScrollSync()

  const panelLayout = useMemo(
    () => ({
      displayItems,
      alignedRows: aligned.rows,
      leftModel,
      rightModel,
      rowIndex,
      collapsedRows,
      regions,
      toggleRowFold,
      expandContext,
      getIntraline,
      labels: resolvedLabels,
      lineHeight: config.lineHeight,
      overscan,
      scrollSync,
      step: collapseOptions?.step ?? 20,
    }),
    [
      displayItems,
      aligned.rows,
      leftModel,
      rightModel,
      rowIndex,
      collapsedRows,
      regions,
      toggleRowFold,
      expandContext,
      getIntraline,
      resolvedLabels,
      config.lineHeight,
      overscan,
      scrollSync,
      collapseOptions,
    ],
  )

  const visibleRows = useMemo(
    () => displayItems.filter((item) => item.rowIndex >= 0).map((item) => item.rowIndex),
    [displayItems],
  )

  const diffState = useMemo(
    () => ({
      left: leftModel,
      right: rightModel,
      alignedRows: aligned.rows,
      visibleRows,
      stats: aligned.stats,
      approximate: aligned.approximate,
      collapsedRegions: regions.filter((region): region is CollapsedRegion => region !== null),
      expandContext,
      collapsed: collapsedRows,
      isRowFolded: (row: number) => collapsedRows.has(row),
      toggleRowFold,
      expandAll,
      collapseAll,
      labels: resolvedLabels,
    }),
    [
      leftModel,
      rightModel,
      aligned,
      visibleRows,
      regions,
      expandContext,
      collapsedRows,
      toggleRowFold,
      expandAll,
      collapseAll,
      resolvedLabels,
    ],
  )

  const slots = useMemo(() => (children ? splitSlots(children, 'chrome') : null), [children])
  const panels = slots
    ? slots.panels
    : [
        <Panel key="left" side="left" />,
        ...(showMinimap ? [<Minimap key="minimap" />] : []),
        <Panel key="right" side="right" />,
      ]

  return (
    <DiffContext.Provider value={diffState}>
      <PanelLayoutContext.Provider value={panelLayout}>
        <section
          className={className ? `krona-diff ${className}` : 'krona-diff'}
          style={style}
          aria-label={resolvedLabels.document}
        >
          {slots ? slots.chrome : null}
          <div
            className={
              panels.length > 2 ? 'krona-panels krona-panels--with-minimap' : 'krona-panels'
            }
          >
            {panels}
          </div>
        </section>
      </PanelLayoutContext.Provider>
    </DiffContext.Provider>
  )
}

function expandOne(
  region: CollapsedRegion,
  direction: ExpandDirection,
  step: number,
): CollapsedRegion | null {
  if (direction === 'all') return null
  const size = region.endRow - region.startRow + 1
  if (step >= size) return null
  return direction === 'up'
    ? { startRow: region.startRow + step, endRow: region.endRow }
    : { startRow: region.startRow, endRow: region.endRow - step }
}
