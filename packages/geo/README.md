# @mb-digital/geo

Country, state and city lookups for the browser, without shipping the world in your bundle.

The country list is small enough to bundle. Everything below it — regions, cities — is fetched per
country and per region from immutable, versioned shards, cached for a year, and never downloaded
twice. No maintained package ships a city list to the browser; this one does not either.

```bash
npm install @mb-digital/geo
```

```ts
import { getCountries, getRegions, getCities } from '@mb-digital/geo'

const countries = await getCountries()      // 250 rows, one request
const regions = await getRegions('US')      // only if country.hasRegions
const cities = await getCities('US', 'CA')  // only if region.hasCities
```

`hasRegions` and `hasCities` let you skip a request you already know comes back empty — roughly a
fifth of countries have no regions at all.

Each shard is fetched at most once per page load. A failed fetch is not cached, so the next attempt
retries rather than leaving the tab permanently broken after a deploy.

## Countries without a request

```ts
import { countries, countryFlagEmoji } from '@mb-digital/geo/countries'

countries() // [{ code: 'AF', name: 'Afghanistan' }, ...] — synchronous, no network
countryFlagEmoji('UA') // 🇺🇦, by codepoint arithmetic rather than a lookup table
```

## Pointing it elsewhere

```ts
import { configure } from '@mb-digital/geo'

configure({ baseUrl: 'https://cdn.jsdelivr.net/npm/@mb-digital/geo-data@1.0.0/v1' })
```

The default host is `https://geo.revenuerush.com/v1`. `configure` also accepts a `fetch`
implementation, which is how the tests run without a network.

## Licence

MIT for this client. The data it reads, `@mb-digital/geo-data`, is a derivative of the
[dr5hn countries-states-cities database](https://github.com/dr5hn/countries-states-cities-database)
and is licensed ODbL-1.0.
