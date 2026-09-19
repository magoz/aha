// Verifies that vendored anti-slop + local plans-policy rules actually fire.
// Run via `pnpm lint:fixtures`. Exits non-zero with a diagnostic if expectations break.
import { execFileSync } from 'node:child_process'

const run = (args) => {
  try {
    const output = execFileSync('pnpm', ['exec', 'oxlint', ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    })

    return { status: 0, output }
  } catch (error) {
    const stdout = error?.stdout?.toString() ?? ''
    const stderr = error?.stderr?.toString() ?? ''

    return { status: error?.status ?? 1, output: `${stdout}\n${stderr}` }
  }
}

const expectMatch = (output, pattern, label) => {
  if (!pattern.test(output)) {
    console.error(`missing expected lint finding: ${label}`)
    console.error(output)
    process.exit(1)
  }
}

const good = run([
  '--config',
  'tools/oxlint/fixtures.config.ts',
  'tools/oxlint/fixtures/good-clean.ts'
])

if (good.status !== 0) {
  console.error('clean fixture should pass lint')
  console.error(good.output)
  process.exit(1)
}

const bad = run([
  '--config',
  'tools/oxlint/fixtures.config.ts',
  'tools/oxlint/fixtures/bad-policy.ts'
])

if (bad.status === 0) {
  console.error('bad-policy fixture should fail lint')
  process.exit(1)
}

expectMatch(bad.output, /plans-policy\(no-any\)/, 'plans-policy/no-any')

expectMatch(
  bad.output,
  /plans-policy\(no-unsafe-assertion\)|anti-slop\(no-chained-type-assertions\)/,
  'assertion rule'
)

expectMatch(
  bad.output,
  /plans-policy\(no-non-null-assertion\)/,
  'plans-policy/no-non-null-assertion'
)

const badEffect = run([
  '--config',
  'tools/oxlint/fixtures.config.ts',
  'tools/oxlint/fixtures/bad-effect-policy.ts'
])

if (badEffect.status === 0) {
  console.error('bad-effect-policy fixture should fail lint')
  process.exit(1)
}

expectMatch(
  badEffect.output,
  /plans-policy\(no-broad-catch-cause\)/,
  'plans-policy/no-broad-catch-cause'
)

expectMatch(
  badEffect.output,
  /plans-policy\(no-sync-schema-codec\)/,
  'plans-policy/no-sync-schema-codec'
)

expectMatch(
  badEffect.output,
  /plans-policy\(no-disable-validation\)/,
  'plans-policy/no-disable-validation'
)

console.log('lint fixtures verified')
