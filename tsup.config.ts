import { defineConfig } from 'tsup'

export default defineConfig({
  entry: { 'cli/plans': 'cli/plans.ts' },
  format: ['esm'],
  platform: 'node',
  target: 'node24',
  banner: { js: '#!/usr/bin/env node' },
  clean: false,
  dts: false,
  sourcemap: true
})
