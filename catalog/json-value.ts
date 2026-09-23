/**
 * Plain JSON value contract for component inputs.
 *
 * Component JSON blocks decode from this type at the CLI boundary with
 * Effect Schema. It is a named recursive union so browser bundles and
 * lint rules never see `unknown`, `any` or `object`.
 */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | ReadonlyArray<JsonValue>
  | { readonly [key: string]: JsonValue }
