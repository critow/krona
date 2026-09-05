import { describe, expect, it } from 'vitest'
import { injectStyles } from './injectStyles'

describe('injectStyles', () => {
  it('puts the nonce on the element it creates', () => {
    // A page whose Content-Security-Policy names a nonce in `style-src` refuses
    // a `<style>` without one, and the viewer arrives unstyled.
    const doc = document.implementation.createHTMLDocument('krona')
    injectStyles(doc, { nonce: 'r4nd0m' })
    const style = doc.getElementById('krona-styles') as HTMLStyleElement | null
    expect(style?.nonce).toBe('r4nd0m')
    expect(style?.textContent).toContain('.krona')
  })

  it('injects once per document', () => {
    const doc = document.implementation.createHTMLDocument('krona')
    injectStyles(doc)
    injectStyles(doc, { nonce: 'later' })
    expect(doc.querySelectorAll('#krona-styles')).toHaveLength(1)
  })

  it('leaves the attribute off when no nonce was given', () => {
    const doc = document.implementation.createHTMLDocument('krona')
    injectStyles(doc)
    expect(doc.getElementById('krona-styles')?.hasAttribute('nonce')).toBe(false)
  })
})
