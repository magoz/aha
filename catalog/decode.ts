import { Match, Predicate, SchemaIssue } from 'effect'

/**
 * Shared decode helpers for JSON components. Turns an Effect Schema issue
 * tree into the block-scoped error fields authors see: a dotted field path
 * plus the human-readable detail from the default formatter.
 */

function appendSegment(current: string, segment: PropertyKey): string {
  if (Predicate.isString(segment)) {
    if (current.length === 0) {
      return segment
    }

    return `${current}.${segment}`
  }

  if (Predicate.isNumber(segment)) {
    return `${current}[${String(segment)}]`
  }

  return current
}

function joinPath(prefix: string, path: ReadonlyArray<PropertyKey>): string {
  let out = prefix

  for (const segment of path) {
    out = appendSegment(out, segment)
  }

  return out
}

function firstChildPath(issues: ReadonlyArray<SchemaIssue.Issue>): string {
  const first = issues[0]

  if (first === undefined) {
    return ''
  }

  return firstIssuePath(first)
}

export function firstIssuePath(issue: SchemaIssue.Issue): string {
  return Match.value(issue).pipe(
    Match.tag('Pointer', (pointer) => {
      const inner = firstIssuePath(pointer.issue)
      const head = joinPath('', pointer.path)

      if (inner.length === 0) {
        return head
      }

      if (inner.startsWith('[')) {
        return `${head}${inner}`
      }

      if (head.length === 0) {
        return inner
      }

      return `${head}.${inner}`
    }),
    Match.tag('Composite', (composite) => firstChildPath(composite.issues)),
    Match.tag('AnyOf', (anyOf) => firstChildPath(anyOf.issues)),
    Match.tag('Filter', (filter) => firstIssuePath(filter.issue)),
    Match.tag('Encoding', (encoding) => firstIssuePath(encoding.issue)),
    Match.orElse(() => '')
  )
}

const formatIssue = SchemaIssue.makeFormatterDefault()

export function formatIssueDetail(issue: SchemaIssue.Issue): string {
  const full = formatIssue(issue)
  const newline = full.indexOf('\n')

  if (newline === -1) {
    return full
  }

  return full.slice(0, newline)
}
