import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/formats/json.ts',
    'src/formats/json5.ts',
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
})
