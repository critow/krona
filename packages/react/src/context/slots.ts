import { Children, isValidElement, type ReactNode } from 'react'

/**
 * Where a part belongs in a mode's layout.
 *
 * - `chrome` — above the scrolling content (toolbars, diagnostics, your own headers)
 * - `canvas` — a column inside the viewer's scroll area (gutter, lines)
 * - `panels` — a column of the diff's panel row (panels, minimap)
 */
export type KronaSlot = 'chrome' | 'canvas' | 'panels'

/** Components carrying this static field are placed automatically. */
export interface SlottedComponent {
  kronaSlot?: KronaSlot
}

const SLOTS: ReadonlySet<string> = new Set<KronaSlot>(['chrome', 'canvas', 'panels'])

function slotOf(node: ReactNode, fallback: KronaSlot): KronaSlot {
  if (!isValidElement(node)) return fallback
  const slot = (node.type as SlottedComponent)?.kronaSlot
  // Three regions exist and no more. TypeScript says so to a TypeScript
  // caller; a component from plain JavaScript can carry any string, and
  // `groups['__proto__']` would answer with `Object.prototype`, whose `push`
  // does not exist — one stray field and the whole render throws.
  return typeof slot === 'string' && SLOTS.has(slot) ? (slot as KronaSlot) : fallback
}

/**
 * Splits a custom layout into the regions a mode renders.
 *
 * This is what lets `Krona.Gutter` and `Krona.Lines` be written as plain
 * siblings while still ending up inside the scroll container they need, and
 * why arbitrary JSX can sit between parts without breaking the layout.
 */
export function splitSlots(
  children: ReactNode,
  fallback: KronaSlot,
): Record<KronaSlot, ReactNode[]> {
  const groups: Record<KronaSlot, ReactNode[]> = { chrome: [], canvas: [], panels: [] }
  for (const child of Children.toArray(children)) {
    groups[slotOf(child, fallback)].push(child)
  }
  return groups
}
