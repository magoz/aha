import * as Alchemy from 'alchemy'
import { RemovalPolicy } from 'alchemy'
import * as Cloudflare from 'alchemy/Cloudflare'
import * as Effect from 'effect/Effect'

function bucketNameForStage(stage: string): string {
  if (stage === 'prod') {
    return 'plans-prod'
  }

  return 'plans-dev'
}

export default Alchemy.Stack(
  'plans',
  {
    providers: Cloudflare.providers(),
    state: Cloudflare.state()
  },
  Effect.gen(function* () {
    const stack = yield* Alchemy.Stack

    const bucket = yield* Cloudflare.R2.Bucket('plans-bucket', {
      name: bucketNameForStage(stack.stage),
      forceDestroy: false
    }).pipe(RemovalPolicy.retain())

    return { bucketName: bucket.bucketName }
  })
)
