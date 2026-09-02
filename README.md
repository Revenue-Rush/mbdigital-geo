# mbdigital-geo

Country, state and city data for MB Digital products, as a small client plus versioned static
shards. Replaces `country-state-city`, which was abandoned in September 2023, is GPL-3.0, and put
roughly 10 MB of JSON into every consumer's bundle.

| Package | Registry | Licence | What it holds |
| --- | --- | --- | --- |
| `@mb-digital/geo` | npm, public | MIT | The client. No rows. |
| `@mb-digital/geo-data` | npm, public | ODbL-1.0 | The generated shards. |

The split is not bureaucracy: the code is ours and the data is not, so they cannot share a licence.
It also gives the data a free mirror, since jsDelivr serves any file out of a published package.

## Why the data is not in the bundle

`city.json` in the old package is 9 544 919 bytes unpacked and 1 732 612 bytes brotli on the wire.
No maintained package ships a city list to the browser; every live one moved that layer behind a
network boundary. The owner of the underlying dataset publishes a browser client carrying zero rows.

So: the country list is small enough to bundle, and everything below it is fetched per country and
per region, cached immutably, and never downloaded twice.

## Usage

```ts
import { getCountries, getRegions, getCities } from '@mb-digital/geo'

const countries = await getCountries()          // 250 rows, one request
const regions = await getRegions('US')          // only if country.hasRegions
const cities = await getCities('US', 'CA')      // only if region.hasCities
```

Each shard is fetched at most once per page load, and the browser cache covers the rest — the
responses are immutable for a year.

`hasRegions` and `hasCities` exist so a client can skip a request it already knows will come back
empty. Roughly a fifth of countries have no regions at all.

### Pointing it somewhere else

```ts
import { configure } from '@mb-digital/geo'

configure({ baseUrl: 'https://cdn.jsdelivr.net/npm/@mb-digital/geo-data@1.0.0/v1' })
```

The default is `https://geo.revenuerush.com/v1`. It is configurable from the first release
deliberately, so hosting can move without a breaking change in every consumer.

### Countries without a request

```ts
import { countries, countryFlagEmoji } from '@mb-digital/geo/countries'
```

Synchronous, network-free, code and English name only — for rendering a country select on first
paint. `countryFlagEmoji` derives the flag by codepoint arithmetic rather than a hand-maintained
map, which is what each consumer was keeping its own copy of.

## Repository layout

```
packages/geo/        the client
packages/geo-data/   generated shards, not hand-edited
tools/generator/     downloads dr5hn, drops unused fields, shards, pre-compresses
```

`tools/generator` is not published. It emits `.br` and `.gz` twins alongside every file, because
CloudFront cannot compress at brotli quality 11 on the fly.

## Releasing

A tag is the only thing that publishes. `npm version`, push the tag, and the release workflow runs
tests, builds, and publishes both packages with provenance.

CI runs `npm pack --dry-run` on every pull request and prints the tarball contents. Read it. That is
where secrets and stray source files leak, and a publish cannot be undone after 72 hours.

## Attribution

Data derived from the [dr5hn countries-states-cities
database](https://github.com/dr5hn/countries-states-cities-database), licensed ODbL-1.0. Derivative
databases carry the same licence, which is why `@mb-digital/geo-data` is ODbL and the client is MIT.
