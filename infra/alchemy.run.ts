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
    const { accountId } = yield* yield* Cloudflare.CloudflareEnvironment
    const bucketName = bucketNameForStage(stack.stage)

    const bucket = yield* Cloudflare.R2.Bucket('plans-bucket', {
      name: bucketName,
      forceDestroy: false
    }).pipe(RemovalPolicy.retain())

    const token = yield* Cloudflare.ApiToken.AccountApiToken('plans-r2-access', {
      name: `${bucketName}-service`,
      policies: [
        {
          effect: 'allow',
          permissionGroups: [
            'Workers R2 Storage Bucket Item Read',
            'Workers R2 Storage Bucket Item Write'
          ],
          resources: {
            [`com.cloudflare.edge.r2.bucket.${accountId}_default_${bucketName}`]: '*'
          }
        }
      ]
    })

    // The token value remains in private Alchemy state, never in CLI output.
    return { bucketName: bucket.bucketName, r2TokenId: token.tokenId }
  })
)
