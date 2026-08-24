/**
 * Krona ships no i18n runtime. Every visible string lives here with an English
 * default, and consumers replace the ones they need through the `labels` prop —
 * so the library never has to know about locales, plural rules or a translation
 * loader.
 *
 * @example
 * ```tsx
 * <Krona labels={{ collapseAll: 'Свернуть всё', hiddenLines: (n) => `⋯ ${n} строк` }} />
 * ```
 */
export interface KronaLabels {
  /** Toolbar action that expands every folding range. */
  expandAll: string
  /** Toolbar action that collapses every folding range. */
  collapseAll: string
  /** Accessible name of a gutter chevron that will expand its block. */
  expandBlock: string
  /** Accessible name of a gutter chevron that will collapse its block. */
  collapseBlock: string
  /** Placeholder next to a collapsed block, e.g. `12 lines`. */
  foldedLines: (count: number) => string
  /** Bar standing in for a hidden run of unchanged diff rows. */
  hiddenLines: (count: number) => string
  /** Button revealing hidden rows above. */
  expandUp: string
  /** Button revealing hidden rows below. */
  expandDown: string
  /** Button revealing an entire hidden run. */
  expandAllHidden: string
  added: string
  removed: string
  changed: string
  unchanged: string
  /** Accessible name of the left diff panel. */
  leftPanel: string
  /** Accessible name of the right diff panel. */
  rightPanel: string
  /** Accessible name of the change minimap. */
  changeMap: string
  /** Tooltip for a rendered-visible dangerous character, given its `U+XXXX` code. */
  unsafeCharacter: (code: string) => string
  /** Accessible name of the viewer or diff region. */
  document: string
}

/**
 * Builds the English defaults. Numbers are formatted with `Intl.NumberFormat`
 * so grouping follows `locale` even before a translation is supplied.
 */
export function createDefaultLabels(locale?: string): KronaLabels {
  const format = new Intl.NumberFormat(locale)
  return {
    expandAll: 'Expand all',
    collapseAll: 'Collapse all',
    expandBlock: 'Expand block',
    collapseBlock: 'Collapse block',
    foldedLines: (count) => `${format.format(count)} lines`,
    hiddenLines: (count) => `${format.format(count)} unchanged lines`,
    expandUp: 'Expand up',
    expandDown: 'Expand down',
    expandAllHidden: 'Expand all',
    added: 'Added',
    removed: 'Removed',
    changed: 'Changed',
    unchanged: 'Unchanged',
    leftPanel: 'Previous version',
    rightPanel: 'Current version',
    changeMap: 'Change map',
    unsafeCharacter: (code) => `Hidden character ${code}`,
    document: 'Configuration file',
  }
}

/** Merges a caller's partial overrides over the defaults. */
export function resolveLabels(
  overrides: Partial<KronaLabels> | undefined,
  locale: string | undefined,
): KronaLabels {
  const defaults = createDefaultLabels(locale)
  return overrides ? { ...defaults, ...overrides } : defaults
}
