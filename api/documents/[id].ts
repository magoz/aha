import { runPlansRequest } from '../../server/vercel-adapter.js'

export default {
  fetch(request: Request): Promise<Response> {
    return runPlansRequest(request, null)
  }
}
