import { defineConfig } from 'oxlint'

export default defineConfig({
  ignorePatterns: [
    '.alchemy/**',
    '.vercel/**',
    'dist/**',
    'node_modules/**',
    'coverage/**',
    'infra/node_modules/**',
    'infra/dist/**',
    'tools/oxlint/anti-slop/**',
    'tools/oxlint/fixtures/**'
  ],
  jsPlugins: [
    { name: 'anti-slop', specifier: './tools/oxlint/anti-slop/index.ts' },
    { name: 'anti-slop-effect', specifier: './tools/oxlint/anti-slop/effect/index.ts' },
    { name: 'aha-policy', specifier: './tools/oxlint/aha-policy/index.ts' }
  ],
  rules: {
    'oxc/no-accumulating-spread': 'error',
    'anti-slop/no-array-filter-map': 'error',
    'anti-slop/no-reduce-accumulator-copy': 'error',
    'anti-slop/no-chained-type-assertions': 'error',
    'anti-slop/no-conditional-empty-object-spread': 'error',
    'anti-slop/no-known-value-widening': 'error',
    'anti-slop/no-module-mocking': 'error',
    'anti-slop/no-object-parameters': 'error',
    'anti-slop/no-reflect-apply': 'error',
    'anti-slop/no-reflect-get': 'error',
    'anti-slop/no-runtime-typeof': 'error',
    'anti-slop/no-shape-in-symbol-names': 'error',
    'anti-slop/no-unknown-parameters': 'error',
    'anti-slop/no-unknown-returns': 'error',
    'anti-slop/no-unknown-type-aliases': 'error',
    'anti-slop/no-unsafe-dictionary-type': 'error',
    'anti-slop/no-widen-then-assert': 'error',
    'anti-slop/require-readable-spacing': 'error',
    'anti-slop/require-safety-comment-for-type-assertion': 'error',
    'anti-slop-effect/no-manual-effect-error-tag': 'error',
    'anti-slop-effect/no-manual-tag-comparison': 'error',
    'anti-slop-effect/no-manual-tagged-construction': 'error',
    'anti-slop-effect/no-service-constructor-imports': 'error',
    'anti-slop-effect/prefer-effect-match': 'error',
    'aha-policy/no-any': 'error',
    'aha-policy/no-non-null-assertion': 'error',
    'aha-policy/no-unsafe-assertion': 'error',
    'aha-policy/no-sync-schema-codec': 'error',
    'aha-policy/no-disable-validation': 'error',
    'aha-policy/no-broad-catch-cause': 'error'
  }
})
