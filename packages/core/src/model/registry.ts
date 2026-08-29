import type { FormatProvider, FormatRegistry } from './types'

const providers = new Map<string, FormatProvider>()

/**
 * Registers a format provider in the module-level registry.
 *
 * Krona's entry point registers JSON, TOML and INI. YAML lives behind
 * `@kronajs/core/yaml` (`krona/yaml`) because the `yaml` parser is tens of
 * kilobytes and must not reach bundles that only ever show JSON.
 *
 * @example
 * ```ts
 * import { registerFormat } from '@kronajs/core'
 * import { yamlProvider } from '@kronajs/core/yaml'
 *
 * registerFormat(yamlProvider)
 * ```
 */
export function registerFormat(provider: FormatProvider): void {
  providers.set(provider.id, provider)
}

/** Removes a provider. Mainly useful in tests. */
export function unregisterFormat(id: string): void {
  providers.delete(id)
}

/** Looks a provider up by id. */
export function getFormat(id: string): FormatProvider | undefined {
  return providers.get(id)
}

/** All currently registered providers, in registration order. */
export function listFormats(): readonly FormatProvider[] {
  return [...providers.values()]
}

/** The module-level registry, used by `parseDocument` unless one is passed in. */
export const defaultRegistry: FormatRegistry = {
  get: (id) => providers.get(id),
  list: () => [...providers.values()],
}

/**
 * Picks the most likely format for `source` among *registered* providers only —
 * `format="auto"` never resurrects a provider the consumer chose not to import.
 *
 * Returns `'text'` when nothing is confident enough.
 */
export function detectFormat(
  source: string,
  lines: readonly string[],
  registry: FormatRegistry = defaultRegistry,
): string {
  let bestId = 'text'
  let bestScore = 0.1
  for (const provider of registry.list()) {
    if (provider.id === 'text' || !provider.detect) continue
    let score: number
    try {
      score = provider.detect(source, lines)
    } catch {
      continue
    }
    if (score > bestScore) {
      bestScore = score
      bestId = provider.id
    }
  }
  return bestId
}
