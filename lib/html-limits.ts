export const HTML_CONTENT_TYPE = 'text/html; charset=utf-8'

// Workers accept request bodies up to 100 MB (decimal) on Free and Pro zones; 95 MiB leaves room
// for headers. One limit for CLI, Worker and preview.
export const MAX_HTML_BYTES = 95 * 1024 * 1024

export function isHtmlContentType(value: string): boolean {
  const lowered = value.toLowerCase()
  const main = lowered.split(';')[0]

  if (main === undefined) {
    return false
  }

  return main.trim() === 'text/html'
}
