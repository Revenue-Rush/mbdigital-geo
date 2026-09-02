import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const generatorRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(generatorRoot, '..', '..');

export const MAX_CITY_SHARD_BROTLI_BYTES = 25 * 1024;

export const SCHEMA_VERSION = 1;

/**
 * Pinned to a release tag, not master. Upstream ships roughly monthly; following master would mean
 * two builds of the same commit producing different data, which makes a published version
 * unreproducible and a shard diff impossible to attribute.
 */
export const SOURCE_TAG = 'v3.2-export.7';

export const SOURCE_URL =
    `https://raw.githubusercontent.com/dr5hn/countries-states-cities-database/${SOURCE_TAG}/json/countries%2Bstates%2Bcities.json`;

export const DOWNLOAD_TIMEOUT_MS = 10 * 60 * 1000;

export const CACHE_DIR = resolve(generatorRoot, '.cache');
export const CACHE_FILE = resolve(CACHE_DIR, 'countries+states+cities.json');

export const OUTPUT_DIR = resolve(repoRoot, 'packages', 'geo-data', `v${SCHEMA_VERSION}`);

export const COMPRESSION_CONCURRENCY = 8;

export const SIZE_DRIFT_THRESHOLD = 0.05;
