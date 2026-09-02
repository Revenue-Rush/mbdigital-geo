import { COUNTRY_NAMES } from './countries.data.ts'

/**
 * Synchronous, network-free entry point: ISO 3166-1 alpha-2 code and English name only.
 *
 * The country list is the one layer worth bundling — 250 rows, under 2 KB brotli — because it is
 * on the critical path of every registration and checkout form, and a round trip there is far more
 * expensive than the bytes. Regions and cities stay fetched, because that is where the megabytes
 * are: the dataset this replaces put 1.75 MiB brotli into the bundle to answer the same question.
 */

export interface StaticCountry {
  code: string
  name: string
}

const collator = new Intl.Collator('en')

const sorted: StaticCountry[] = Object.entries(COUNTRY_NAMES)
  .map(([code, name]) => ({ code, name }))
  .sort((a, b) => collator.compare(a.name, b.name))

export const countries = (): StaticCountry[] => sorted

export const countryName = (code: string): string | undefined => COUNTRY_NAMES[code.toUpperCase()]

export const countryCount = sorted.length

/**
 * ISO 3166-1 alpha-2 to regional-indicator codepoints. Replaces the hand-maintained code-to-flag
 * maps each consumer was keeping its own copy of.
 */
export const countryFlagEmoji = (code: string): string =>
  code
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .split('')
    .map(character => String.fromCodePoint(0x1f1e6 + character.charCodeAt(0) - 65))
    .join('')
