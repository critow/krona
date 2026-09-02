/**
 * The only two ways this package creates nodes.
 *
 * Krona's promise is that a configuration file can never become markup: there
 * is no `innerHTML` anywhere in it, and text reaches the page as a text node or
 * not at all. A custom element builds its own DOM by hand rather than from a
 * template string for exactly that reason.
 */

/** Creates an element, sets its class, and appends text or children. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  children?: string | readonly Node[],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (typeof children === 'string') node.textContent = children
  else if (children) node.append(...children)
  return node
}

const SVG = 'http://www.w3.org/2000/svg'

/** The fold chevron, drawn rather than written, so it needs no font or icon set. */
export function chevron(): SVGSVGElement {
  const svg = document.createElementNS(SVG, 'svg')
  svg.setAttribute('class', 'krona-fold-chevron')
  svg.setAttribute('viewBox', '0 0 12 12')
  svg.setAttribute('aria-hidden', 'true')
  svg.setAttribute('focusable', 'false')
  const path = document.createElementNS(SVG, 'path')
  path.setAttribute('d', 'M2.5 4.5 6 8l3.5-3.5')
  path.setAttribute('fill', 'none')
  path.setAttribute('stroke', 'currentColor')
  path.setAttribute('stroke-width', '2')
  path.setAttribute('stroke-linecap', 'round')
  path.setAttribute('stroke-linejoin', 'round')
  svg.append(path)
  return svg
}
