export interface Country {
  code: string
  name: string
  hasRegions: boolean
}

export interface Region {
  code: string
  name: string
  hasCities: boolean
}

export interface GeoConfig {
  /**
   * Where the versioned data shards live. Configurable from the first release so hosting can move
   * between CloudFront and a mirror without a breaking change in every consumer.
   */
  baseUrl: string
  fetch: typeof globalThis.fetch
}

export type GeoConfigInput = Partial<GeoConfig>
