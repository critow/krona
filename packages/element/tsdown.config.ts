import { copyFileSync } from 'node:fs'
import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/formats/json.ts',
    'src/formats/yaml.ts',
    'src/formats/toml.ts',
    'src/formats/ini.ts',
  ],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  treeshake: true,
  outDir: 'dist',
  unbundle: true,
  hooks: {
    // The same bytes the constant carries, for consumers who own their CSS
    // pipeline. A custom element puts the stylesheet in its shadow root itself,
    // so this file is only for pages that would rather ship one stylesheet.
    'build:done': () => {
      copyFileSync('../../styles/krona.css', 'dist/styles.css')
    },
  },
})
