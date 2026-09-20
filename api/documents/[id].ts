import { runAhaRequest } from '../../server/vercel-adapter.js'

export default {
  fetch(request: Request): Promise<Response> {
    return runAhaRequest(request, null)
  }
}
