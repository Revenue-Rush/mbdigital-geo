import { fetchShard, getConfig } from './config.ts'
import type { Country, Region } from './types.ts'

export { configure } from './config.ts'
export type { Country, Region, GeoConfig, GeoConfigInput } from './types.ts'

type CountriesShard = { v: number; countries: [code: string, name: string, hasRegions: boolean][] }
type RegionsShard = { v: number; country: string; regions: [code: string, name: string, hasCities: boolean][] }
type CitiesShard = { v: number; country: string; region: string; cities: string[] }

const cache = new Map<string, Promise<unknown>>()

const once = <T>(key: string, load: () => Promise<T>): Promise<T> => {
  const existing = cache.get(key) as Promise<T> | undefined
  if (existing) return existing

  const pending = load().catch(error => {
    // A rejected promise must not be cached: a shard that 404s during a deploy would otherwise stay
    // broken for the life of the tab, with no way back but a reload.
    cache.delete(key)
    throw error
  })

  cache.set(key, pending)

  return pending
}

export const getCountries = (): Promise<Country[]> =>
  once('countries', async () => {
    const shard = await fetchShard<CountriesShard>('countries.json')

    return shard.countries.map(([code, name, hasRegions]) => ({ code, name, hasRegions }))
  })

export const getRegions = (countryCode: string): Promise<Region[]> =>
  once(`regions/${countryCode}`, async () => {
    const shard = await fetchShard<RegionsShard>(`regions/${countryCode}.json`)

    return shard.regions.map(([code, name, hasCities]) => ({ code, name, hasCities }))
  })

export const getCities = (countryCode: string, regionCode: string): Promise<string[]> =>
  once(`cities/${countryCode}-${regionCode}`, async () => {
    const shard = await fetchShard<CitiesShard>(`cities/${countryCode}-${regionCode}.json`)

    return shard.cities
  })

export const resetCache = (): void => {
  cache.clear()
}

export const getBaseUrl = (): string => getConfig().baseUrl
