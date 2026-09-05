import { copyFileSync } from 'node:fs'
import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/formats/json.ts',
    'src/formats/json5.ts',
    'src/formats/xml.ts',
    'src/formats/hcl.ts',
    'src/formats/properties.ts',
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
  external: ['react', 'react-dom', 'react/jsx-runtime'],
  hooks: {
    // Consumers who own their CSS pipeline import `kronajs/styles.css`; the same
    // bytes are also available as a constant for runtime injection.
    'build:done': () => {
      copyFileSync('../../styles/krona.css', 'dist/styles.css')
    },
  },
})
