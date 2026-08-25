import type { DocumentModel, Format } from '@krona/core'
import { useVirtualizer } from '@tanstack/react-virtual'
import { type CSSProperties, type ReactNode, useMemo, useRef } from 'react'
import { useKronaConfig } from '../context/config'
import { LineSourceContext, type RenderRow } from '../context/lineSource'
import { splitSlots } from '../context/slots'
import { useDocument } from '../hooks/useDocument'
import { computeVisibleLines, useFoldState } from '../hooks/useFoldState'
import { type KronaLabels, resolveLabels } from '../labels'
import { Diagnostics } from '../parts/Diagnostics'
import { Gutter } from '../parts/Gutter'
import { Lines } from '../parts/Lines'
import { contentColumnsOf } from '../render/width'
import { ViewerContext } from './ViewerContext'

/** Props of `<Krona.Viewer>`. */
export interface KronaViewerProps {
  /** File contents to display. Provide this or {@link KronaViewerProps.model}. */
  source?: string
  /**
   * A model parsed elsewhere — in a Web Worker, for instance — used as is.
   * Takes precedence over `source`.
   */
  model?: DocumentModel
  /** Overrides the format from the enclosing `<Krona>`. */
  format?: Format
  /** Overrides the labels from the enclosing `<Krona>`. */
  labels?: Partial<KronaLabels>
  /**
   * Collapse every folding range at this nesting depth or deeper on load.
   * `0` collapses everything; omit to start fully expanded.
   */
  defaultCollapsedDepth?: number
  /** Extra rows rendered outside the viewport. Default 8. */
  overscan?: number
  /** Show parse errors above the document. Default true. */
  showDiagnostics?: boolean
  className?: string
  style?: CSSProperties
  /**
   * Custom layout. Without children the viewer renders its default layout,
   * assembled from the same public parts.
   */
  children?: ReactNode
}

/**
 * Read-only viewer with editor-style folding.
 *
 * @example
 * ```tsx
 * <Krona format="json">
 *   <Krona.Viewer source={text} defaultCollapsedDepth={2} />
 * </Krona>
 * ```
 *
 * @example Custom layout from the same parts
 * ```tsx
 * <Krona.Viewer source={text}>
 *   <MyHeader />
 *   <Krona.Gutter />
 *   <Krona.Lines />
 * </Krona.Viewer>
 * ```
 */
export function KronaViewer({
  source,
  model: providedModel,
  format,
  labels,
  defaultCollapsedDepth,
  overscan = 8,
  showDiagnostics = true,
  className,
  style,
  children,
}: KronaViewerProps) {
  const config = useKronaConfig()
  const model = useDocument(
    source,
    providedModel,
    format ?? config.format,
    config.limits,
    config.providers,
  )
  const foldState = useFoldState(model, defaultCollapsedDepth)

  const resolvedLabels = useMemo(
    () => (labels ? resolveLabels({ ...config.labels, ...labels }, config.locale) : config.labels),
    [labels, config.labels, config.locale],
  )

  const visibleLines = useMemo(
    () => computeVisibleLines(model, foldState.collapsed),
    [model, foldState.collapsed],
  )

  const rows = useMemo<RenderRow[]>(
    () => visibleLines.map((lineIndex) => ({ lineIndex, tone: 'normal' as const })),
    [visibleLines],
  )

  const scrollRef = useRef<HTMLDivElement | null>(null)
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => config.lineHeight,
    overscan,
  })

  const virtualItems = virtualizer.getVirtualItems()
  const totalSize = virtualizer.getTotalSize()

  const contentColumns = useMemo(() => contentColumnsOf(model), [model])

  const lineSource = useMemo(
    () => ({
      side: 'single' as const,
      model,
      rows,
      virtualizer,
      virtualItems,
      totalSize,
      scrollRef,
      labels: resolvedLabels,
      lineHeight: config.lineHeight,
      maxLineNumber: model.lines.length,
      contentColumns,
      isFolded: foldState.isFolded,
      toggleFold: foldState.toggleFold,
      foldAt: (lineIndex: number) => model.foldAt(lineIndex),
    }),
    [
      model,
      rows,
      virtualizer,
      virtualItems,
      totalSize,
      resolvedLabels,
      config.lineHeight,
      contentColumns,
      foldState,
    ],
  )

  const viewerState = useMemo(
    () => ({ ...foldState, model, visibleLines, labels: resolvedLabels }),
    [foldState, model, visibleLines, resolvedLabels],
  )

  const slots = useMemo(() => (children ? splitSlots(children, 'chrome') : null), [children])
  const chrome = slots ? slots.chrome : showDiagnostics ? [<Diagnostics key="diagnostics" />] : []
  const canvas = slots ? slots.canvas : [<Gutter key="gutter" />, <Lines key="lines" />]

  return (
    <ViewerContext.Provider value={viewerState}>
      <LineSourceContext.Provider value={lineSource}>
        <section
          className={className ? `krona-viewer ${className}` : 'krona-viewer'}
          style={style}
          aria-label={resolvedLabels.document}
        >
          {chrome}
          <div className="krona-scroll" ref={scrollRef}>
            <div className="krona-canvas" style={{ height: `${totalSize}px` }}>
              {canvas}
            </div>
          </div>
        </section>
      </LineSourceContext.Provider>
    </ViewerContext.Provider>
  )
}
