import { describe, expect, it } from 'vitest'
import { splitSlots } from './slots'

const Chrome = Object.assign(() => null, { kronaSlot: 'chrome' as const })
/** A component out of plain JavaScript, carrying a field TypeScript forbids. */
const Odd = Object.assign(() => null, { kronaSlot: '__proto__' as 'chrome' })

describe('splitSlots', () => {
  it('places a part by the region its component names', () => {
    const groups = splitSlots([<Chrome key="a" />, <div key="b" />], 'canvas')
    expect(groups.chrome).toHaveLength(1)
    expect(groups.canvas).toHaveLength(1)
    expect(groups.panels).toHaveLength(0)
  })

  it('sends a slot name it does not know to the fallback region', () => {
    // `groups['__proto__']` is `Object.prototype`, which has no `push`: without
    // the check this throws and takes the whole render with it.
    const groups = splitSlots([<Odd key="a" />, <Chrome key="b" />], 'canvas')
    expect(groups.canvas).toHaveLength(1)
    expect(groups.chrome).toHaveLength(1)
    expect(groups.panels).toHaveLength(0)
  })
})
