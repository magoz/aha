import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterAll } from '@effect/vitest'

// CLI fallback reads the user's home directory. Tests must never consume real
// credentials, even when run on a machine where Plans is already configured.
const home = await mkdtemp(join(tmpdir(), 'plans-test-home-'))

const previousHome = process.env['HOME']

const previousUserProfile = process.env['USERPROFILE']

process.env['HOME'] = home

process.env['USERPROFILE'] = home

afterAll(async () => {
  if (previousHome === undefined) {
    delete process.env['HOME']
  } else {
    process.env['HOME'] = previousHome
  }

  if (previousUserProfile === undefined) {
    delete process.env['USERPROFILE']
  } else {
    process.env['USERPROFILE'] = previousUserProfile
  }

  await rm(home, { recursive: true, force: true })
})
