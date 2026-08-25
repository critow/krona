/**
 * One step of a path: an object key, or an index into a sequence.
 */
export type PathPart = string | number

/**
 * True for a key that can be written after a dot and still read back as one key.
 *
 * A character scan rather than a regular expression: this runs once per line
 * during analysis, and the answer is almost always yes after the first
 * character.
 */
function isBareKey(key: string): boolean {
  if (key.length === 0) return false
  for (let i = 0; i < key.length; i++) {
    const code = key.charCodeAt(i)
    const alpha = (code >= 65 && code <= 90) || (code >= 97 && code <= 122)
    const digit = code >= 48 && code <= 57
    const symbol = code === 95 /* _ */ || code === 36 /* $ */ || (i > 0 && code === 45) /* - */
    if (alpha || symbol || (digit && i > 0)) continue
    return false
  }
  return true
}

/**
 * Attaches one already-formatted piece to a path.
 *
 * An index binds to what precedes it — `ciphers[0]`, never `ciphers.[0]` — and
 * so does a bracketed key, which is how a key that cannot be written after a dot
 * gets written instead.
 */
function attach(path: string, piece: string): string {
  if (piece === '') return path
  if (piece.startsWith('[')) return path + piece
  return path === '' ? piece : `${path}.${piece}`
}

/**
 * Formats the parts a single line contributes into one path fragment.
 *
 * A line can contribute more than one part: a TOML `[server.tls]` header names
 * two levels at once, and both belong to the line that wrote them.
 */
export function pathSegmentOf(parts: readonly PathPart[]): string {
  let out = ''
  for (const part of parts) {
    if (typeof part === 'number') out += `[${part}]`
    else out = attach(out, isBareKey(part) ? part : `[${JSON.stringify(part)}]`)
  }
  return out
}

/**
 * Joins the fragments of a line and its containers into a whole path.
 *
 * The fragments come from {@link pathSegmentOf} and are already formatted, so
 * this only decides how each one attaches to what came before.
 */
export function joinPath(fragments: readonly string[]): string {
  let path = ''
  for (const fragment of fragments) path = attach(path, fragment)
  return path
}
