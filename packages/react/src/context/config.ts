import type { Format, FormatRegistry, ParseLimits } from '@kronajs/core'
import { createContext, useContext } from 'react'
import type { KronaLabels } from '../labels'

/** Colour scheme. `'auto'` follows the operating system via `prefers-color-scheme`. */
export type KronaTheme = 'light' | 'dark' | 'auto'

/** Configuration shared by every Krona mode below a `<Krona>` root. */
export interface KronaConfig {
  readonly format: Format
  readonly theme: KronaTheme
  readonly labels: KronaLabels
  readonly locale: string | undefined
  /** Row height in pixels. Fixed, which is what makes virtualization exact. */
  readonly lineHeight: number
  readonly limits: Partial<ParseLimits> | undefined
  readonly providers: FormatRegistry | undefined
  /**
   * True while the root is narrower than `narrowWidth`. Modes use it to lay
   * themselves out for the space they actually have — a diff shows one panel at
   * a time rather than two unreadable ones.
   */
  readonly narrow: boolean
}

export const KronaConfigContext = createContext<KronaConfig | null>(null)

/**
 * Reads the nearest `<Krona>` configuration.
 *
 * @throws if called outside a `<Krona>` root.
 */
export function useKronaConfig(): KronaConfig {
  const config = useContext(KronaConfigContext)
  if (!config) {
    throw new Error('Krona: this component must be rendered inside <Krona>.')
  }
  return config
}
