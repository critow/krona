/**
 * The custom-element page: no React, no framework, one script tag.
 *
 * It exists to be the proof rather than the claim. The React playground could
 * pass while `@kronajs/element` was broken in every way that matters — a
 * registration that throws, a stylesheet that never reaches the shadow root, a
 * virtualizer that paints nothing — and nothing would have noticed.
 */
import { defineKrona, type KronaChangeDetail, type KronaViewerElement } from '@kronajs/element'
import '@kronajs/element/yaml'
import { SAMPLES } from './samples'
import './styles.css'

defineKrona()

const sample = (id: string) => SAMPLES.find((entry) => entry.id === id)

const viewer = document.getElementById('viewer') as HTMLElement & { source: string }
const yaml = sample('yaml')
if (yaml) viewer.source = yaml.left

const diff = document.getElementById('diff') as HTMLElement & { left: string; right: string }
const json = sample('json')
if (json) {
  diff.left = json.left
  diff.right = json.right
}

const editor = document.getElementById('editor') as KronaViewerElement
const toml = sample('toml')
if (toml) editor.source = toml.left

const edits = document.getElementById('edits')
const undo = document.getElementById('undo') as HTMLButtonElement
const redo = document.getElementById('redo') as HTMLButtonElement
let count = 0

// The page holds the text, the element reports it: an editable viewer is a
// control, and a control that kept the only copy of its value would be a
// strange one.
editor.addEventListener('krona-change', (event) => {
  const { source } = (event as CustomEvent<KronaChangeDetail>).detail
  count += 1
  if (edits) edits.textContent = `${count} change${count === 1 ? '' : 's'}, ${source.length} bytes`
  undo.disabled = !editor.canUndo
  redo.disabled = !editor.canRedo
})
undo.disabled = true
redo.disabled = true
undo.addEventListener('click', () => editor.undo())
redo.addEventListener('click', () => editor.redo())
