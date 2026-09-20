import { runAhaRequest } from '../server/vercel-adapter.js'

function notFound(): Response {
  return new Response('not found', {
    status: 404,
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' }
  })
}

export default {
  fetch(request: Request): Promise<Response> {
    const id = new URL(request.url).searchParams.get('id')

    if (id === null || id.length === 0) {
      return Promise.resolve(notFound())
    }

    return runAhaRequest(request, `/${id}`)
  }
}
