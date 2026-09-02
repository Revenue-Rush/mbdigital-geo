import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'

import { configure, getCities, getCountries, getRegions, resetCache } from './index.ts'
import { countryFlagEmoji } from './countries.ts'

const shards: Record<string, unknown> = {
  'countries.json': {
    v: 1,
    countries: [
      ['US', 'United States', true],
      ['MC', 'Monaco', false]
    ]
  },
  'regions/US.json': { v: 1, country: 'US', regions: [['CA', 'California', true]] },
  'cities/US-CA.json': { v: 1, country: 'US', region: 'CA', cities: ['Los Angeles', 'San Francisco'] }
}

let requests: { url: string; init?: RequestInit }[] = []

const stubFetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const url = String(input)
  requests.push({ url, init })
  const path = url.replace('https://test.invalid/v1/', '')
  const body = shards[path]

  if (!body) return new Response('not found', { status: 404 })

  return new Response(JSON.stringify(body), { status: 200 })
}) as typeof globalThis.fetch

configure({ baseUrl: 'https://test.invalid/v1/', fetch: stubFetch })

afterEach(() => {
  resetCache()
  requests = []
})

describe('geo client', () => {
  it('reads countries and reports which have regions', async () => {
    const countries = await getCountries()

    assert.deepEqual(countries, [
      { code: 'US', name: 'United States', hasRegions: true },
      { code: 'MC', name: 'Monaco', hasRegions: false }
    ])
  })

  it('trims a trailing slash off the configured base url', async () => {
    await getCountries()

    assert.equal(requests[0]?.url, 'https://test.invalid/v1/countries.json')
  })

  it('never sends credentials, so the CDN response stays cacheable', async () => {
    await getCountries()

    assert.equal(requests[0]?.init?.credentials, 'omit')
  })

  it('fetches each shard once, however many callers ask', async () => {
    await Promise.all([getRegions('US'), getRegions('US'), getRegions('US')])

    assert.equal(requests.length, 1)
  })

  it('reads cities of a region', async () => {
    assert.deepEqual(await getCities('US', 'CA'), ['Los Angeles', 'San Francisco'])
  })

  it('does not cache a failure, so the next attempt retries', async () => {
    await assert.rejects(() => getRegions('XX'), /responded 404/)
    await assert.rejects(() => getRegions('XX'), /responded 404/)

    assert.equal(requests.length, 2)
  })

  it('derives a flag from the country code by arithmetic, not a lookup table', () => {
    assert.equal(countryFlagEmoji('UA'), '🇺🇦')
    assert.equal(countryFlagEmoji('us'), '🇺🇸')
  })
})
