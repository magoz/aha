import type { Effect } from 'effect'

import type { BlockDecodeError } from './errors.js'
import type { JsonValue } from './json-value.js'

/**
 * Core catalog contracts. Component modules implement this interface and
 * register themselves in their category registry; the CLI, build and
 * showcase only program against this type, so phase-2 workers never touch
 * shared files when adding a component to an existing category.
 */

export interface FieldDoc {
  readonly path: string
  readonly type: string
  readonly description: string
  readonly required: boolean
}

export interface ComponentExample {
  readonly id: string
  readonly title: string
  readonly caption: string
  /** Canonical JSON source for JSON components, null for markup ones. */
  readonly json: string | null
  /** Child markup source for markup components, null for JSON ones. */
  readonly markup: string | null
  /** Wrapper kind for markup examples, null for JSON ones. */
  readonly markupKind: string | null
}

export interface JsonRenderRequest {
  readonly blockIndex: number
  readonly idPrefix: string
  readonly width: number
  readonly json: JsonValue
}

export interface MarkupRenderRequest {
  readonly blockIndex: number
  readonly idPrefix: string
  readonly attributes: ReadonlyArray<MarkupAttribute>
  readonly innerHtml: string
}

export interface MarkupAttribute {
  readonly name: string
  readonly value: string
}

export interface CatalogComponent {
  readonly name: string
  readonly category: string
  readonly summary: string
  readonly inputKind: 'json' | 'markup'
  /** Natural wrapper tag for markup components (ol, ul, dl, div, aside,
   * figure); null for JSON components. Single source of truth for the
   * `aha components` example block and the showcase. */
  readonly markupTag: string | null
  /** Field docs derived from the component schema annotations. */
  readonly fields: ReadonlyArray<FieldDoc>
  readonly css: string
  /** Built client bundle filename under dist/catalog, null when none. */
  readonly clientBundle: string | null
  readonly examples: ReadonlyArray<ComponentExample>
  readonly renderJson:
    | ((request: JsonRenderRequest) => Effect.Effect<string, BlockDecodeError>)
    | null
  readonly renderMarkup:
    | ((request: MarkupRenderRequest) => Effect.Effect<string, BlockDecodeError>)
    | null
}
