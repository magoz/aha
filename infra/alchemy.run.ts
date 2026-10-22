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
      // Only the custom domain serves Aha: no workers.dev URL and no per-version preview URLs, which
      // would keep old code and secrets reachable after a fix or token rotation.
      workersDev: false,
      env: {
        AHA_BUCKET: bucket,
        AHA_OWNER_TOKEN: Config.Redacted('AHA_OWNER_TOKEN'),
        AHA_PUBLIC_URL: `https://${names.hostname}`
      }
    })

    return { bucketName: bucket.bucketName, url: worker.url }
  })
)
