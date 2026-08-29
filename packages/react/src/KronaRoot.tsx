import type { Format, FormatRegistry, ParseLimits } from '@kronajs/core'
import { type CSSProperties, type ReactNode, useInsertionEffect, useMemo, useRef } from 'react'
import { KronaConfigContext, type KronaTheme } from './context/config'
import { useNarrow } from './hooks/useNarrow'
import { type KronaLabels, resolveLabels } from './labels'
import { injectStyles } from './theme/injectStyles'

/** Props of the `<Krona>` configuration root. */
export interface KronaRootProps {
  /** Format id, or `'auto'` to sniff among registered providers. Default `'auto'`. */
  format?: Format
  /** Colour scheme. Default `'auto'`, which follows `prefers-color-scheme`. */
  theme?: KronaTheme
  /** Overrides for the built-in English strings. */
  labels?: Partial<KronaLabels>
  /** BCP 47 locale used to format numbers inside the default labels. */
  locale?: string
  /**
   * Row height in pixels. Also published as `--krona-line-height`, so the pitch
   * the virtualizer positions rows at and the height CSS paints them at cannot
   * disagree. Fixed height is what makes virtualization exact. Default 20.
   */
  lineHeight?: number
  /**
   * Width in pixels below which the modes lay themselves out for a small
   * screen: a diff shows one panel at a time, and the gutter narrows. Measured
   * on the root itself rather than the window, so a component in a sidebar gets
   * the same treatment as one on a phone. `0` keeps the wide layout always.
   * Default 640.
   */
  narrowWidth?: number
  /** Overrides for the parser's safety limits. */
  limits?: Partial<ParseLimits>
  /** Provider lookup. Defaults to the module-level registry. */
  providers?: FormatRegistry
  /**
   * Adds Krona's stylesheet to `document.head` on mount. Set to false and
   * import `krona/styles.css` yourself when you control the CSS pipeline (or
   * render on the server). Default true.
   */
  injectStyles?: boolean
  className?: string
  style?: CSSProperties
  children?: ReactNode
}

/**
 * Configuration root for Krona. It carries format, theme and labels in context
 * and paints nothing itself beyond a themed container — parsing and state live
 * in `Krona.Viewer` and `Krona.Diff`.
 *
 * @example
 * ```tsx
 * <Krona format="yaml" theme="dark">
 *   <Krona.Viewer source={text} defaultCollapsedDepth={2} />
 * </Krona>
 * ```
 */
export function KronaRoot({
  format = 'auto',
  theme = 'auto',
  labels,
  locale,
  lineHeight = 20,
  narrowWidth = 640,
  limits,
  providers,
  injectStyles: shouldInject = true,
  className,
  style,
  children,
}: KronaRootProps) {
  useInsertionEffect(() => {
    if (shouldInject) injectStyles()
  }, [shouldInject])

  const resolvedLabels = useMemo(() => resolveLabels(labels, locale), [labels, locale])

  const rootRef = useRef<HTMLDivElement | null>(null)
  const narrow = useNarrow(rootRef, narrowWidth)

  const config = useMemo(
    () => ({
      format,
      theme,
      labels: resolvedLabels,
      locale,
      lineHeight,
      limits,
      providers,
      narrow,
    }),
    [format, theme, resolvedLabels, locale, lineHeight, limits, providers, narrow],
  )

  return (
    <KronaConfigContext.Provider value={config}>
      <div
        ref={rootRef}
        className={className ? `krona ${className}` : 'krona'}
        data-theme={theme}
        data-narrow={narrow ? 'true' : undefined}
        // The virtualizer positions rows at `lineHeight`; CSS has to paint them
        // at the same pitch, or the two drift apart as the value moves.
        style={{ ['--krona-line-height' as string]: `${lineHeight}px`, ...style }}
      >
        {children}
      </div>
    </KronaConfigContext.Provider>
  )
}
