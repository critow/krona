/**
 * Detection of characters that make rendered text lie about its own content.
 *
 * Bidirectional overrides let an attacker reorder how a line *displays* without
 * changing what a parser sees (the "Trojan Source" class of attacks,
 * CVE-2021-42574), and zero-width characters hide entirely. A diff viewer that
 * renders them as-is would silently show two different files as identical, so
 * Krona reports their positions and the UI paints a visible badge instead —
 * the same thing GitHub does.
 */

/** Why a character is considered unsafe to render verbatim. */
export type UnsafeKind = 'bidi' | 'invisible' | 'control'

/** A run of exactly one unsafe character inside a line. */
export interface UnsafeSpan {
  /** Inclusive start column, in UTF-16 code units. */
  readonly start: number
  /** Exclusive end column. */
  readonly end: number
  readonly kind: UnsafeKind
  readonly codePoint: number
  /** Locale-neutral badge text, e.g. `U+202E`. */
  readonly label: string
}

const BIDI = new Set([
  0x061c, 0x200e, 0x200f, 0x202a, 0x202b, 0x202c, 0x202d, 0x202e, 0x2066, 0x2067, 0x2068, 0x2069,
])

const INVISIBLE = new Set([
  0x00ad, 0x061c, 0x180e, 0x200b, 0x200c, 0x200d, 0x2060, 0x2061, 0x2062, 0x2063, 0x2064, 0xfeff,
  0xffa0,
])

function classify(cp: number): UnsafeKind | undefined {
  if (BIDI.has(cp)) return 'bidi'
  if (INVISIBLE.has(cp)) return 'invisible'
  // C0 controls except tab, plus DEL and the C1 block.
  if ((cp < 0x20 && cp !== 0x09) || cp === 0x7f || (cp >= 0x80 && cp <= 0x9f)) return 'control'
  // Variation selectors and tag characters (used to smuggle hidden payloads).
  if (cp >= 0xfe00 && cp <= 0xfe0f) return 'invisible'
  if (cp >= 0xe0000 && cp <= 0xe007f) return 'invisible'
  return undefined
}

function toLabel(cp: number): string {
  return `U+${cp.toString(16).toUpperCase().padStart(4, '0')}`
}

/**
 * Finds every unsafe character in a line, left to right. Linear in the line
 * length; no regular expressions are involved, so it cannot backtrack.
 *
 * @example
 * ```ts
 * scanUnsafeCharacters('if (a) {‮')
 * // [{ start: 8, end: 9, kind: 'bidi', codePoint: 0x202e, label: 'U+202E' }]
 * ```
 */
export function scanUnsafeCharacters(text: string): UnsafeSpan[] {
  let spans: UnsafeSpan[] | undefined
  for (let i = 0; i < text.length; ) {
    const cp = text.codePointAt(i) as number
    const width = cp > 0xffff ? 2 : 1
    const kind = classify(cp)
    if (kind !== undefined) {
      spans ??= []
      spans.push({ start: i, end: i + width, kind, codePoint: cp, label: toLabel(cp) })
    }
    i += width
  }
  return spans ?? []
}

/** True when the line contains at least one unsafe character. Allocation free. */
export function hasUnsafeCharacters(text: string): boolean {
  for (let i = 0; i < text.length; ) {
    const cp = text.codePointAt(i) as number
    if (classify(cp) !== undefined) return true
    i += cp > 0xffff ? 2 : 1
  }
  return false
}
