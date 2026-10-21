import * as Alchemy from 'alchemy'
import { RemovalPolicy } from 'alchemy'
import * as Cloudflare from 'alchemy/Cloudflare'
import * as Config from 'effect/Config'
import * as Effect from 'effect/Effect'

interface StageNames {
  readonly bucket: string
  readonly worker: string
  readonly hostname: string
}

function namesForStage(stage: string): StageNames {
  if (stage === 'prod') {
    return { bucket: 'aha-prod', worker: 'aha-prod', hostname: 'aha.o-o.co' }
  }

  return { bucket: 'aha-dev', worker: 'aha-dev', hostname: 'aha-dev.o-o.co' }
}

export default Alchemy.Stack(
  'aha',
  {
    providers: Cloudflare.providers(),
    state: Cloudflare.state()
  },
  Effect.gen(function* () {
    const stack = yield* Alchemy.Stack
    const { accountId } = yield* yield* Cloudflare.CloudflareEnvironment
    const names = namesForStage(stack.stage)

    const bucket = yield* Cloudflare.R2.Bucket('aha-bucket', {
      name: names.bucket,
      publicAccess: false,
      forceDestroy: false
    }).pipe(RemovalPolicy.retain())

    // The Worker reads R2 through its binding; Cloudflare creates the DNS record and certificate for
    // the custom domain. The owner token comes from the deploying shell and is stored as a secret.
    const worker = yield* Cloudflare.Worker('aha-worker', {
      name: names.worker,
      main: '../server/worker.ts',
      compatibility: { date: '2026-10-01' },
      domain: names.hostname,
      env: {
        AHA_BUCKET: bucket,
        AHA_OWNER_TOKEN: Config.Redacted('AHA_OWNER_TOKEN'),
        AHA_PUBLIC_URL: `https://${names.hostname}`
      }
    })

    // Legacy S3-API credential used only by the retired Vercel deployment. Remove this resource
    // once aha.oox.sh redirects to the Worker.
    const token = yield* Cloudflare.ApiToken.AccountApiToken('aha-r2-access', {
      name: `${names.bucket}-service`,
      policies: [
        {
          effect: 'allow',
          permissionGroups: [
            'Workers R2 Storage Bucket Item Read',
            'Workers R2 Storage Bucket Item Write'
          ],
          resources: {
            [`com.cloudflare.edge.r2.bucket.${accountId}_default_${names.bucket}`]: '*'
          }
        }
      ]
    })

    // The token value remains in private Alchemy state, never in CLI output.
    return { bucketName: bucket.bucketName, url: worker.url, r2TokenId: token.tokenId }
  })
)
