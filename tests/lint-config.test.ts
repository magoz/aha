import { describe, expect, it } from 'vitest'

import mainConfig from '../oxlint.config.js'
import fixtureConfig from '../tools/oxlint/fixtures.config.js'

describe('lint config sync', () => {
  it('keeps fixture rules and plugins aligned with the main config', () => {
    expect(fixtureConfig.rules).toEqual(mainConfig.rules)
    expect(fixtureConfig.jsPlugins?.map((plugin) => plugin.name)).toEqual(
      mainConfig.jsPlugins?.map((plugin) => plugin.name)
    )
  })

  it('lints fixtures only in the harness config', () => {
    expect(mainConfig.ignorePatterns?.some((pattern) => pattern.includes('fixtures'))).toBe(true)
    expect(fixtureConfig.ignorePatterns?.some((pattern) => pattern.includes('fixtures'))).toBe(
      false
    )
  })
})
