import type { JsonValue } from '../json-value.js'

/**
 * Browser-safe JSON guards. Client bundles never import Effect, so these
 * local predicates narrow validated block JSON without `typeof` or casts.
 * The build already validated the JSON; guards here only keep the client
 * total when markup is hand-edited afterwards.
 */

export function isJsonText(value: JsonValue): value is string {
  return value === String(value)
}

export function isJsonNumber(value: JsonValue): value is number {
  return value === Number(value) && Number.isFinite(value)
}

export function isJsonBoolean(value: JsonValue): value is boolean {
  return value === true || value === false
}

export function isJsonArray(value: JsonValue): value is ReadonlyArray<JsonValue> {
  return Array.isArray(value)
}

export function isJsonRecord(value: JsonValue): value is { readonly [key: string]: JsonValue } {
  return value instanceof Object && !Array.isArray(value)
}

export function readTextField(
  record: { readonly [key: string]: JsonValue },
  key: string
): string | null {
  const raw = record[key]

  if (raw === undefined || !isJsonText(raw)) {
    return null
  }

  return raw
}

export function readNumberField(
  record: { readonly [key: string]: JsonValue },
  key: string
): number | null {
  const raw = record[key]

  if (raw === undefined || !isJsonNumber(raw)) {
    return null
  }

  return raw
}

export function readBooleanField(
  record: { readonly [key: string]: JsonValue },
  key: string
): boolean {
  const raw = record[key]

  if (raw === undefined || !isJsonBoolean(raw)) {
    return false
  }

  return raw
}

export function readArrayField(
  record: { readonly [key: string]: JsonValue },
  key: string
): ReadonlyArray<JsonValue> | null {
  const raw = record[key]

  if (raw === undefined || !isJsonArray(raw)) {
    return null
  }

  return raw
}

export function readRecordField(
  record: { readonly [key: string]: JsonValue },
  key: string
): { readonly [key: string]: JsonValue } | null {
  const raw = record[key]

  if (raw === undefined || !isJsonRecord(raw)) {
    return null
  }

  return raw
}

export function parseJsonRecord(text: string): { readonly [key: string]: JsonValue } | null {
  let parsed: JsonValue = null

  try {
    parsed = JSON.parse(text)
  } catch {
    return null
  }

  if (isJsonRecord(parsed)) {
    return parsed
  }

  return null
}
