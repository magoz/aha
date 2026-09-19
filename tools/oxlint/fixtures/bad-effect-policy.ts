import { Effect, Schema } from 'effect'

export const BadSchema = Schema.String

export const program = Effect.catchAllCause(Effect.succeed('x'), () =>
  Effect.succeed('recovered')
)

export const decoded = Schema.decodeSync(BadSchema)('x')

export const validated = Schema.parseJson(BadSchema, { disableValidation: true })
