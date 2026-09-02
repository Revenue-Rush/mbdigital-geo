import type { GeoConfig, GeoConfigInput } from './types.ts'

const DEFAULT_BASE_URL = 'https://geo.revenuerush.com/v1'

let config: GeoConfig = {
  baseUrl: DEFAULT_BASE_URL,
  fetch: (...args) => globalThis.fetch(...args)
}

export const configure = (input: GeoConfigInput): void => {
  config = { ...config, ...input, baseUrl: (input.baseUrl ?? config.baseUrl).replace(/\/+$/, '') }
}

export const getConfig = (): GeoConfig => config

/**
 * `credentials: 'omit'` is not incidental. Consumers reach for their shared axios instance, which
 * sets `withCredentials`, and a session cookie on a 570-byte immutable response both defeats the
 * CDN cache and costs more than the payload.
 */
export const fetchShard = async <T>(path: string): Promise<T> => {
  const { baseUrl, fetch } = config
  const response = await fetch(`${baseUrl}/${path}`, {
    credentials: 'omit',
    headers: { accept: 'application/json' }
  })

  if (!response.ok) {
    throw new Error(`geo: ${path} responded ${response.status}`)
  }

  return (await response.json()) as T
}
