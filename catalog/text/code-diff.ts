import { Effect, Schema } from 'effect'

import type { CatalogComponent, ComponentExample, JsonRenderRequest } from '../component.js'
import { describeSchemaFields } from '../fields.js'
import { BlockDecodeError } from '../errors.js'
import { firstIssuePath, formatIssueDetail } from '../decode.js'
import { renderCodeDiff } from './code-diff-render.js'
import { CodeDiffSchema } from './code-diff-schema.js'
import { CODE_DIFF_CSS } from './code-diff-css.js'

/**
 * code-diff component definition. A unified diff with a file header,
 * both line numbers and a colour-independent marker column.
 */

function decodeRequest(request: JsonRenderRequest): Effect.Effect<string, BlockDecodeError> {
  return Schema.decodeUnknownEffect(CodeDiffSchema)(request.json).pipe(
    Effect.mapError(
      (parseError) =>
        new BlockDecodeError({
          blockIndex: request.blockIndex,
          component: 'code-diff',
          path: firstIssuePath(parseError.issue),
          detail: formatIssueDetail(parseError.issue)
        })
    ),
    Effect.flatMap((decoded) => {
      if (decoded.diff.trim().length === 0) {
        return Effect.fail(
          new BlockDecodeError({
            blockIndex: request.blockIndex,
            component: 'code-diff',
            path: 'diff',
            detail: 'expected unified diff text'
          })
        )
      }

      return Effect.succeed(renderCodeDiff(decoded, { idPrefix: request.idPrefix }))
    })
  )
}

const EXAMPLE_JSON = `{
  "file": "gateway/policy.ts",
  "diff": "@@ -12,7 +12,7 @@ export function forwardPolicy(request: PolicyRequest) {\\n   if (isApiPath(request.path)) {\\n     return deny(404)\\n   }\\n-  if (request.ageMs > 30000) {\\n+  if (request.ageMs > 10000) {\\n     return deny(504)\\n   }\\n \\n   return allow(request)\\n@@ -31,5 +31,6 @@ export function forwardPolicy(request: PolicyRequest) {\\n   stripHeaders(request, ['authorization', 'cookie'])\\n \\n   if (isRedirect(status)) {\\n-    return fail('redirect from origin')\\n+    throw new GatewayRedirectError({ status })\\n   }\\n }"
}`

const EXAMPLES: ReadonlyArray<ComponentExample> = [
  {
    id: 'gateway-timeout',
    title: 'Gateway timeout and redirect errors',
    caption: 'Two hunks: a tighter timeout and a typed redirect error.',
    json: EXAMPLE_JSON,
    markup: null,
    markupKind: null
  }
]

export const codeDiffComponent: CatalogComponent = {
  name: 'code-diff',
  category: 'text',
  summary: 'Unified diff with a file header, line numbers and a marker column.',
  inputKind: 'json',
  markupTag: null,
  fields: describeSchemaFields(CodeDiffSchema),
  css: CODE_DIFF_CSS,
  clientBundle: null,
  examples: EXAMPLES,
  renderJson: decodeRequest,
  renderMarkup: null
}
