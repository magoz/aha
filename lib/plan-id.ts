import { Effect, Schema } from 'effect'

// Accepted for every existing-document operation: legacy random 22-character base64url IDs and
// readable names. No dots, slashes or percent signs, so an ID can never become an arbitrary key.
const PLAN_ID_PATTERN = /^[A-Za-z0-9_-]{1,80}$/

const NEW_DOCUMENT_NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export const MAX_DOCUMENT_NAME_LENGTH = 80

// Names that collide with top-level routes (`/api/...`).
const RESERVED_DOCUMENT_NAMES: ReadonlySet<string> = new Set(['api'])

export const PlanIdSchema = Schema.String.pipe(
  Schema.check(Schema.isPattern(PLAN_ID_PATTERN)),
  Schema.brand('PlanId')
)

export type PlanId = Schema.Schema.Type<typeof PlanIdSchema>

export class InvalidPlanId extends Schema.TaggedError<InvalidPlanId>()('InvalidPlanId', {
  value: Schema.String
}) {}

export class InvalidDocumentName extends Schema.TaggedError<InvalidDocumentName>()(
  'InvalidDocumentName',
  { value: Schema.String }
) {}

export function isPlanId(value: string): value is PlanId {
  return PLAN_ID_PATTERN.test(value)
}

export function parsePlanId(value: string): Effect.Effect<PlanId, InvalidPlanId> {
  if (isPlanId(value)) {
    return Effect.succeed(value)
  }

  return Effect.fail(new InvalidPlanId({ value }))
}

export function isReservedDocumentName(value: string): boolean {
  return RESERVED_DOCUMENT_NAMES.has(value.toLowerCase())
}

// A name chosen when creating a document: stricter than an accepted ID.
export const NewDocumentNameSchema = PlanIdSchema.pipe(
  Schema.check(
    Schema.isMaxLength(MAX_DOCUMENT_NAME_LENGTH),
    Schema.isPattern(NEW_DOCUMENT_NAME_PATTERN),
    Schema.makeFilter((value: string) => !isReservedDocumentName(value))
  )
)

export const isNewDocumentName = Schema.is(NewDocumentNameSchema)

export function parseNewDocumentName(value: string): Effect.Effect<PlanId, InvalidDocumentName> {
  return Schema.decodeUnknownEffect(NewDocumentNameSchema)(value).pipe(
    Effect.mapError(() => new InvalidDocumentName({ value }))
  )
}

export function documentKey(id: PlanId): string {
  return `aha/${id}.html`
}

export function markerKey(id: PlanId): string {
  return `public/${id}`
}
