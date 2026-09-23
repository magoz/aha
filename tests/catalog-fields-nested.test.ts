import { describe, expect, it } from '@effect/vitest'

import { formatComponentDetail } from '../catalog/components.js'

/**
 * `aha components <name>` must document nested fields with dotted paths
 * (series[].name, series[].values[].x) and print a recursive schema
 * reference once instead of looping forever.
 */

function detail(name: string): string {
  const out = formatComponentDetail(name, false)

  expect(out).not.toBe(null)

  if (out === null) {
    return ''
  }

  return out
}

describe('nested field docs', () => {
  it('recurses into arrays of structs with dotted paths', () => {
    const line = detail('line-chart')

    expect(line).toContain('series (array<object>, required)')
    expect(line).toContain('series[].name')
    expect(line).toContain('series[].values[].x')
    expect(line).toContain('series[].values[].y')
  })

  it('recurses into nested option structs', () => {
    const line = detail('line-chart')

    expect(line).toContain('x.kind')
    expect(line).toContain('x.format.style')
    expect(line).toContain('y.label')

    const table = detail('data-table')

    expect(table).toContain('columns[].key')
    expect(table).toContain('columns[].type')
  })

  it('prints recursive schemas once instead of looping', () => {
    const table = detail('schema-table')

    expect(table).toContain('fields[].name')
    expect(table).toContain('fields[].fields (recursive: same as fields[], optional)')
  })
})
