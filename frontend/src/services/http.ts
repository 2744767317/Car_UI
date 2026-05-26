export interface HttpRequestOptions extends RequestInit {
  json?: unknown
}

export class HttpError extends Error {
  readonly status: number
  readonly url: string
  readonly bodyText: string

  constructor(message: string, status: number, url: string, bodyText = '') {
    super(message)
    this.name = 'HttpError'
    this.status = status
    this.url = url
    this.bodyText = bodyText
  }
}

const isAbsoluteUrl = (value: string): boolean => /^https?:\/\//i.test(value)

export const withBaseUrl = (baseUrl: string, path: string): string => {
  if (!path) return baseUrl
  if (isAbsoluteUrl(path) || !baseUrl) return path
  const base = baseUrl.replace(/\/+$/, '')
  const next = path.startsWith('/') ? path : `/${path}`
  return `${base}${next}`
}

export async function requestJson<T>(url: string, options: HttpRequestOptions = {}): Promise<T> {
  const { json, headers, ...init } = options
  const requestHeaders = new Headers(headers || {})

  let body = init.body
  if (json !== undefined) {
    requestHeaders.set('Content-Type', 'application/json')
    body = JSON.stringify(json)
  }

  const response = await fetch(url, {
    ...init,
    body,
    headers: requestHeaders,
  })

  const bodyText = await response.text()
  if (!response.ok) {
    throw new HttpError(`HTTP ${response.status}`, response.status, url, bodyText)
  }

  if (!bodyText) {
    return undefined as T
  }

  try {
    return JSON.parse(bodyText) as T
  } catch {
    return bodyText as T
  }
}
