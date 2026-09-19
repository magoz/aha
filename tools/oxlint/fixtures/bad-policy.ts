export const badAny: any = 'slop'

export const coerced = 'x' as unknown as string

export const forced = 'x'!

export function widened(input: string): unknown {
  return input
}
