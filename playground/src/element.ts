/**
 * The custom-element page: no React, no framework, one script tag.
 *
 * It exists to be the proof rather than the claim. The React playground could
 * pass while `@kronajs/element` was broken in every way that matters — a
 * registration that throws, a stylesheet that never reaches the shadow root, a
 * virtualizer that paints nothing — and nothing would have noticed.
 */
import { defineKrona } from '@kronajs/element'
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
