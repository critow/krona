import { describe, expect, it } from 'vitest'
import { emptyHistory, withEdit, withRedo, withUndo } from './history'

const replace = (start: number, end: number, text: string) => ({ start, end, text })

describe('EditHistory', () => {
  it('starts on the text it was given, with nowhere to go', () => {
    const history = emptyHistory('name: krona')
    expect(history.source).toBe('name: krona')
    expect(history.undo).toHaveLength(0)
    expect(history.redo).toHaveLength(0)
  })

  it('walks back and forward through several edits', () => {
    let history = emptyHistory('a')
    history = withEdit(history, replace(1, 1, 'b'))
    history = withEdit(history, replace(2, 2, 'c'))
    expect(history.source).toBe('abc')

    history = withUndo(history)
    expect(history.source).toBe('ab')
    history = withUndo(history)
    expect(history.source).toBe('a')

    history = withRedo(history)
    expect(history.source).toBe('ab')
    history = withRedo(history)
    expect(history.source).toBe('abc')
  })

  it('keeps spans rather than snapshots, so a long file costs the change only', () => {
    const long = 'x'.repeat(100_000)
    const history = withEdit(emptyHistory(long), replace(0, 1, 'y'))
    const [inverse] = history.undo
    expect(inverse).toBeDefined()
    // The inverse restores one character, not a hundred thousand.
    expect(inverse?.text).toBe('x')
    expect(withUndo(history).source).toBe(long)
  })

  it('ends the redo branch when a new edit lands on top', () => {
    let history = withEdit(emptyHistory('a'), replace(1, 1, 'b'))
    history = withUndo(history)
    expect(history.redo).toHaveLength(1)

    history = withEdit(history, replace(1, 1, 'z'))
    expect(history.source).toBe('az')
    expect(history.redo).toHaveLength(0)
  })

  it('answers with the very same history when there is nowhere to go', () => {
    const history = emptyHistory('a')
    // Identity, not just equality: a view can compare by reference to decide
    // whether anything happened at all.
    expect(withUndo(history)).toBe(history)
    expect(withRedo(history)).toBe(history)
  })

  it('leaves the history it was given untouched', () => {
    const history = emptyHistory('a')
    withEdit(history, replace(1, 1, 'b'))
    expect(history.source).toBe('a')
    expect(history.undo).toHaveLength(0)
  })
})
