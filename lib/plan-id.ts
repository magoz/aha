import { Effect, Schema } from 'effect'
import { randomBytes } from 'node:crypto'

const PLAN_ID_PATTERN = /^[A-Za-z0-9_-]{22}$/

export const PlanIdSchema = Schema.String.pipe(
  Schema.check(Schema.isPattern(PLAN_ID_PATTERN)),
  Schema.brand('PlanId')
)

export type PlanId = Schema.Schema.Type<typeof PlanIdSchema>

export class InvalidPlanId extends Schema.TaggedError<InvalidPlanId>()('InvalidPlanId', {
  value: Schema.String
}) {}

export const PLAN_ID_LENGTH = 22

export function isPlanId(value: string): value is PlanId {
  return PLAN_ID_PATTERN.test(value)
}

export function parsePlanId(value: string): Effect.Effect<PlanId, InvalidPlanId> {
  if (isPlanId(value)) {
    return Effect.succeed(value)
  }

  return Effect.fail(new InvalidPlanId({ value }))
}

export function generatePlanId(): Effect.Effect<PlanId> {
  return Effect.sync(() => randomBytes(16).toString('base64url')).pipe(
    Effect.map((raw) => raw.slice(0, PLAN_ID_LENGTH)),
    Effect.flatMap((candidate) => {
      if (isPlanId(candidate)) {
        return Effect.succeed(candidate)
      }

      return generatePlanId()
    })
  )
}

export function documentKey(id: PlanId): string {
  return `aha/${id}.html`
}

export function markerKey(id: PlanId): string {
  return `public/${id}`
}
