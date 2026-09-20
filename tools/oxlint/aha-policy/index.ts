import { defineRule, eslintCompatPlugin } from '@oxlint/plugins'
import { Predicate } from 'effect'
import type { ESTree } from '@oxlint/plugins'

const SYNC_CODEC_NAMES = new Set([
  'decodeSync',
  'encodeSync',
  'decodeUnknownSync',
  'encodeUnknownSync',
  'decodeOption',
  'encodeOption'
])

function calleePropertyName(callee: ESTree.Node): string | null {
  if (callee.type !== 'MemberExpression' && callee.type !== 'ChainExpression') {
    return null
  }

  const target = callee.type === 'ChainExpression' ? callee.expression : callee

  if (target.type !== 'MemberExpression') {
    return null
  }

  if (target.property.type === 'Identifier') {
    return target.property.name
  }

  if (target.property.type === 'Literal' && Predicate.isString(target.property.value)) {
    return target.property.value
  }

  return null
}

function calleeObjectName(callee: ESTree.Node): string | null {
  const target = callee.type === 'ChainExpression' ? callee.expression : callee

  if (target.type !== 'MemberExpression') {
    return null
  }

  if (target.object.type === 'Identifier') {
    return target.object.name
  }

  return null
}

/** Ban explicit `any`. */
export const noAnyRule = defineRule({
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow explicit any; use unknown with boundary parsing or a precise type.'
    },
    messages: {
      noAny:
        'Explicit `any` discards type evidence. Use `unknown` with Schema boundary parsing or a precise domain type.'
    }
  },
  createOnce(context) {
    return {
      TSAnyKeyword(node) {
        context.report({ node, messageId: 'noAny' })
      }
    }
  }
})

/** Ban non-null assertions. */
export const noNonNullAssertionRule = defineRule({
  meta: {
    type: 'problem',
    docs: { description: 'Disallow non-null assertions; narrow with explicit checks or Schema.' },
    messages: {
      noNonNull:
        'Non-null assertion assumes without evidence. Narrow with an explicit check or boundary parsing.'
    }
  },
  createOnce(context) {
    return {
      TSNonNullExpression(node) {
        context.report({ node, messageId: 'noNonNull' })
      }
    }
  }
})

function isConstAssertion(node: ESTree.TSAsExpression | ESTree.TSTypeAssertion): boolean {
  const { typeAnnotation } = node

  return (
    typeAnnotation.type === 'TSTypeReference' &&
    typeAnnotation.typeName.type === 'Identifier' &&
    typeAnnotation.typeName.name === 'const'
  )
}

/** Ban type assertions except `as const`. */
export const noUnsafeAssertionRule = defineRule({
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow type assertions except `as const`; parse at boundaries instead.'
    },
    messages: {
      noAssertion:
        'Type assertion fabricates evidence. Parse untrusted input at the boundary into a precise type instead (only `as const` is allowed).'
    }
  },
  createOnce(context) {
    const check = (node: ESTree.TSAsExpression | ESTree.TSTypeAssertion) => {
      if (isConstAssertion(node)) {
        return
      }

      context.report({ node, messageId: 'noAssertion' })
    }

    return {
      TSAsExpression: check,
      TSTypeAssertion: check
    }
  }
})

/** Ban synchronous Schema codecs that throw. */
export const noSyncSchemaCodecRule = defineRule({
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow sync Schema codecs; use effectful decode/encode at boundaries.'
    },
    messages: {
      noSyncCodec:
        'Sync Schema codec `{{name}}` throws instead of returning an Effect. Use `Schema.decode`, `Schema.encode`, or boundary `Effect` variants.'
    }
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        if (node.callee.type === 'Super' || node.callee.type === 'V8IntrinsicExpression') {
          return
        }

        const name = calleePropertyName(node.callee)

        if (name === null || !SYNC_CODEC_NAMES.has(name)) {
          return
        }

        const objectName = calleeObjectName(node.callee)

        if (objectName !== 'Schema' && objectName !== 'S') {
          return
        }

        context.report({ node, messageId: 'noSyncCodec', data: { name } })
      }
    }
  }
})

/** Ban disableValidation escape hatches. */
export const noDisableValidationRule = defineRule({
  meta: {
    type: 'problem',
    docs: { description: 'Disallow disableValidation; keep Schema validation enabled.' },
    messages: {
      noDisableValidation:
        'Setting `disableValidation` removes boundary evidence. Keep Schema validation enabled.'
    }
  },
  createOnce(context) {
    return {
      Property(node) {
        const key = node.key

        const name =
          key.type === 'Identifier'
            ? key.name
            : key.type === 'Literal' && Predicate.isString(key.value)
              ? key.value
              : null

        if (name === 'disableValidation') {
          context.report({ node, messageId: 'noDisableValidation' })
        }
      },
      PropertyDefinition(node) {
        const key = node.key

        const name =
          key.type === 'Identifier'
            ? key.name
            : key.type === 'Literal' && Predicate.isString(key.value)
              ? key.value
              : null

        if (name === 'disableValidation') {
          context.report({ node, messageId: 'noDisableValidation' })
        }
      }
    }
  }
})

/** Ban broad catchCause wrappers; use tagged handlers. */
export const noBroadCatchCauseRule = defineRule({
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow broad catchCause/catchAllCause; use Effect.catchTag/catchTags or Match.'
    },
    messages: {
      noCatchCause:
        'Broad `{{name}}` swallows tagged error evidence. Handle `{{name}}` with `Effect.catchTag`, `Effect.catchTags`, or `Effect.catchIf` on a tagged error.'
    }
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        if (node.callee.type === 'Super' || node.callee.type === 'V8IntrinsicExpression') {
          return
        }

        const name = calleePropertyName(node.callee)

        if (name !== 'catchCause' && name !== 'catchAllCause') {
          return
        }

        const objectName = calleeObjectName(node.callee)

        if (objectName !== 'Effect') {
          return
        }

        context.report({ node, messageId: 'noCatchCause', data: { name } })
      }
    }
  }
})

const ahaPolicyPlugin = eslintCompatPlugin({
  meta: { name: 'aha-policy' },
  rules: {
    'no-any': noAnyRule,
    'no-non-null-assertion': noNonNullAssertionRule,
    'no-unsafe-assertion': noUnsafeAssertionRule,
    'no-sync-schema-codec': noSyncSchemaCodecRule,
    'no-disable-validation': noDisableValidationRule,
    'no-broad-catch-cause': noBroadCatchCauseRule
  }
})

export default ahaPolicyPlugin
