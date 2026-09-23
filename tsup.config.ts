import { readdirSync } from 'node:fs'
import { basename } from 'node:path'

import { defineConfig } from 'tsup'

// Every catalog/**/<name>.client.ts becomes dist/catalog/<name>.client.js, so adding a
// component never edits this file.
function catalogClientEntries(): Map<string, string> {
  const entries = new Map<string, string>()

  for (const file of readdirSync('catalog', { recursive: true, encoding: 'utf8' })) {
    if (file.endsWith('.client.ts')) {
      entries.set(`catalog/${basename(file, '.ts')}`, `catalog/${file}`)
    }
  }

  return entries
}

export default defineConfig([
  {
    entry: { 'cli/aha': 'cli/aha.ts' },
    format: ['esm'],
    platform: 'node',
    target: 'node24',
    banner: { js: '#!/usr/bin/env node' },
    clean: false,
    dts: false,
    sourcemap: true
  },
  {
    entry: Object.fromEntries(catalogClientEntries()),
    format: ['iife'],
    platform: 'browser',
    target: 'es2020',
    minify: true,
    outExtension: () => ({ js: '.js' }),
    clean: false,
    dts: false,
    sourcemap: false,
    treeshake: true
  }
])
