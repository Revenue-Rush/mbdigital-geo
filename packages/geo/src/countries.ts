/**
 * Synchronous, network-free entry point. Only the ISO 3166-1 alpha-2 code and the English name, for
 * the one case that genuinely cannot wait for a request: rendering a country select on first paint.
 *
 * Everything below this level — regions, cities — is fetched, because that is where the size is.
 */

export interface StaticCountry {
  code: string
  name: string
}

const NAMES: Record<string, string> = {}

/**
 * Populated at build time from the same dataset the shards come from. Kept as a plain record rather
 * than a tuple array so bundlers can see it is inert data with no side effects.
 */
export const setStaticCountries = (names: Record<string, string>): void => {
  for (const [code, name] of Object.entries(names)) NAMES[code] = name
}

export const countries = (): StaticCountry[] =>
  Object.entries(NAMES)
    .map(([code, name]) => ({ code, name }))
    .sort((a, b) => a.name.localeCompare(b.name, 'en'))

export const countryName = (code: string): string | undefined => NAMES[code]

/**
 * ISO 3166-1 alpha-2 to regional-indicator codepoints. Replaces the hand-maintained COUNTRY_TO_ISO
 * map that each consumer was keeping its own copy of.
 */
export const countryFlagEmoji = (code: string): string =>
  code
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .split('')
    .map(character => String.fromCodePoint(0x1f1e6 + character.charCodeAt(0) - 65))
    .join('')
