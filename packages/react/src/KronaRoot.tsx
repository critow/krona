import type { Format, FormatRegistry, ParseLimits } from '@krona/core'
import { type CSSProperties, type ReactNode, useInsertionEffect, useMemo } from 'react'
import { KronaConfigContext, type KronaTheme } from './context/config'
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
  /** Row height in pixels. Fixed height is what makes virtualization exact. Default 20. */
  lineHeight?: number
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

  const config = useMemo(
    () => ({
      format,
      theme,
      labels: resolvedLabels,
      locale,
      lineHeight,
      limits,
      providers,
    }),
    [format, theme, resolvedLabels, locale, lineHeight, limits, providers],
  )

  return (
    <KronaConfigContext.Provider value={config}>
      <div className={className ? `krona ${className}` : 'krona'} data-theme={theme} style={style}>
        {children}
      </div>
    </KronaConfigContext.Provider>
  )
}
