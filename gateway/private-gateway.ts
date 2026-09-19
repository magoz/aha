import { startPrivateGateway } from './gateway-server.js'

function resolvePort(): number {
  const argv = process.argv.slice(2)
  const flagIndex = argv.indexOf('--port')

  if (flagIndex !== -1) {
    const raw = argv[flagIndex + 1]

    if (raw !== undefined) {
      const parsed = Number.parseInt(raw, 10)

      if (Number.isSafeInteger(parsed) && parsed > 0 && parsed < 65536) {
        return parsed
      }
    }
  }

  const envRaw = process.env['PORT']

  if (envRaw !== undefined) {
    const parsed = Number.parseInt(envRaw, 10)

    if (Number.isSafeInteger(parsed) && parsed > 0 && parsed < 65536) {
      return parsed
    }
  }

  return 3938
}

startPrivateGateway(resolvePort())
