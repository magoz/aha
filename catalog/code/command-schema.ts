import { Schema } from 'effect'

/**
 * Wire schema for the command component: a shell command with an
 * optional working directory, optional captured output with stdout and
 * stderr lanes, and an optional exit code.
 */

export const CommandOutputLineSchema = Schema.Struct({
  text: Schema.String.annotate({
    description: 'One output line, without the trailing newline.'
  }),
  stderr: Schema.optional(Schema.Boolean).annotate({
    description: 'Set true for stderr lines, drawn in the warning lane with a marker.'
  })
})

export const CommandSchema = Schema.Struct({
  command: Schema.String.annotate({
    description: 'Shell command as typed, e.g. aha build page.html -o built.html.'
  }),
  cwd: Schema.optional(Schema.String).annotate({
    description: 'Working directory shown before the prompt, e.g. ~/aha.'
  }),
  output: Schema.optional(Schema.Array(CommandOutputLineSchema)).annotate({
    description: 'Captured output lines in order; stderr lines take the warning lane.'
  }),
  exitCode: Schema.optional(Schema.Number).annotate({
    description: 'Process exit code; nonzero takes the warning lane.'
  })
})

export type CommandInput = (typeof CommandSchema)['Type']

export type CommandOutputLine = (typeof CommandOutputLineSchema)['Type']
