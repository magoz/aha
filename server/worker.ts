import { handleWorkerRequest } from './worker-handler.js'
import type { WorkerEnv } from './worker-handler.js'

// Worker main module: only the runtime-required default export.
export default {
  fetch: (request: Request, env: WorkerEnv): Promise<Response> => handleWorkerRequest(request, env)
}
