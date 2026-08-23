import { type CSSProperties, memo } from 'react'
import { useKronaConfig } from '../context/config'
import { useLineSource } from '../context/lineSource'

/** Props of `<Krona.Diagnostics>`. */
export interface KronaDiagnosticsProps {
  /** Show warnings as well as errors. Default false. */
  includeWarnings?: boolean
  className?: string
  style?: CSSProperties
}

const DiagnosticsBase = memo(function Diagnostics({
  includeWarnings = false,
  className,
  style,
}: KronaDiagnosticsProps) {
  useKronaConfig()
  const { model } = useLineSource()
  const shown = model.diagnostics.filter(
    (diagnostic) => includeWarnings || diagnostic.severity === 'error',
  )
  if (shown.length === 0) return null

  return (
    <div
      className={className ? `krona-diagnostics ${className}` : 'krona-diagnostics'}
      style={style}
      role="status"
    >
      {shown.map((diagnostic) => (
        <div key={`${diagnostic.code}-${diagnostic.line ?? -1}-${diagnostic.message}`}>
          {diagnostic.line === undefined ? '' : `${diagnostic.line + 1}: `}
          {diagnostic.message}
        </div>
      ))}
    </div>
  )
})

/**
 * `Krona.Diagnostics` — parse problems reported by the format provider.
 *
 * Krona never throws on malformed input; this is where the reason surfaces.
 */
export const Diagnostics = Object.assign(DiagnosticsBase, { kronaSlot: 'chrome' as const })
