import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { CACHE_DIR, CACHE_FILE, DOWNLOAD_TIMEOUT_MS, SOURCE_URL } from './config.js';
import { GeneratorError, describe } from './errors.js';

export interface SourceRegion {
    code: string;
    name: string;
    cities: string[];
}

export interface SourceCountry {
    code: string;
    name: string;
    regions: SourceRegion[];
}

const COUNTRY_CODE_PATTERN = /^[A-Z]{2}$/;

// Region codes are interpolated straight into shard file names, so anything outside this
// set is rejected instead of sanitised: a silent rewrite would break client URLs, and an
// unchecked separator would let dataset content escape the output directory.
const REGION_CODE_PATTERN = /^[A-Za-z0-9]{1,8}$/;

export async function loadSource(refresh: boolean): Promise<SourceCountry[]> {
    if (refresh || !(await isCached())) {
        await download();
    }

    let text: string;
    try {
        text = await readFile(CACHE_FILE, 'utf8');
    } catch (cause) {
        throw new GeneratorError(`could not read the cached dataset at ${CACHE_FILE}: ${describe(cause)}`);
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(text);
    } catch (cause) {
        throw new GeneratorError(
            `the cached dataset at ${CACHE_FILE} is not valid JSON (${describe(cause)}). ` +
                'Delete the file or re-run with --refresh to download it again.',
        );
    }

    return normalise(parsed);
}

async function isCached(): Promise<boolean> {
    try {
        const stats = await stat(CACHE_FILE);
        return stats.isFile() && stats.size > 0;
    } catch {
        return false;
    }
}

async function download(): Promise<void> {
    process.stderr.write(`downloading ${SOURCE_URL}\n`);

    let response: Response;
    try {
        response = await fetch(SOURCE_URL, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
    } catch (cause) {
        throw new GeneratorError(`could not download the dataset from ${SOURCE_URL}: ${describe(cause)}`);
    }

    if (!response.ok) {
        throw new GeneratorError(
            `the dataset download failed with HTTP ${response.status} ${response.statusText} for ${SOURCE_URL}`,
        );
    }

    let body: Buffer;
    try {
        body = Buffer.from(await response.arrayBuffer());
    } catch (cause) {
        throw new GeneratorError(`the dataset download was interrupted: ${describe(cause)}`);
    }

    if (body.byteLength === 0) {
        throw new GeneratorError(`the dataset download returned an empty body from ${SOURCE_URL}`);
    }

    await mkdir(CACHE_DIR, { recursive: true });

    // Stage then rename so an interrupted download never leaves a truncated file behind as a valid cache hit.
    const staging = `${CACHE_FILE}.partial`;
    await writeFile(staging, body);
    await rename(staging, CACHE_FILE);
}

function normalise(parsed: unknown): SourceCountry[] {
    if (!Array.isArray(parsed)) {
        throw new GeneratorError('the dataset root is not an array; the upstream file layout has changed');
    }

    const countries: SourceCountry[] = [];
    const seenCountryCodes = new Set<string>();

    for (const [index, entry] of parsed.entries()) {
        if (!isRecord(entry)) {
            throw new GeneratorError(`dataset entry #${index} is not an object`);
        }

        const code = readText(entry['iso2']);
        const name = readText(entry['name']);

        if (!COUNTRY_CODE_PATTERN.test(code)) {
            throw new GeneratorError(`dataset entry #${index} has an unusable country code ${JSON.stringify(code)}`);
        }
        if (name === '') {
            throw new GeneratorError(`country ${code} has no name`);
        }
        if (seenCountryCodes.has(code)) {
            throw new GeneratorError(`country code ${code} appears twice in the dataset`);
        }
        seenCountryCodes.add(code);

        countries.push({ code, name, regions: normaliseRegions(code, entry['states']) });
    }

    if (countries.length === 0) {
        throw new GeneratorError('the dataset contains no countries');
    }

    return countries;
}

function normaliseRegions(countryCode: string, raw: unknown): SourceRegion[] {
    if (raw === undefined || raw === null) {
        return [];
    }
    if (!Array.isArray(raw)) {
        throw new GeneratorError(`country ${countryCode} has a non-array "states" field`);
    }

    const regions: SourceRegion[] = [];
    const seenRegionCodes = new Set<string>();

    for (const entry of raw) {
        if (!isRecord(entry)) {
            throw new GeneratorError(`country ${countryCode} has a region entry that is not an object`);
        }

        const code = readText(entry['iso2']);
        const name = readText(entry['name']);

        if (!REGION_CODE_PATTERN.test(code)) {
            throw new GeneratorError(
                `country ${countryCode} has a region with an unusable code ${JSON.stringify(code)} (${name || 'unnamed'})`,
            );
        }
        if (name === '') {
            throw new GeneratorError(`region ${countryCode}-${code} has no name`);
        }
        if (seenRegionCodes.has(code)) {
            throw new GeneratorError(`region code ${code} appears twice under country ${countryCode}`);
        }
        seenRegionCodes.add(code);

        regions.push({ code, name, cities: normaliseCities(countryCode, code, entry['cities']) });
    }

    return regions;
}

function normaliseCities(countryCode: string, regionCode: string, raw: unknown): string[] {
    if (raw === undefined || raw === null) {
        return [];
    }
    if (!Array.isArray(raw)) {
        throw new GeneratorError(`region ${countryCode}-${regionCode} has a non-array "cities" field`);
    }

    const names: string[] = [];

    for (const entry of raw) {
        if (!isRecord(entry)) {
            throw new GeneratorError(`region ${countryCode}-${regionCode} has a city entry that is not an object`);
        }
        const name = readText(entry['name']);
        if (name === '') {
            throw new GeneratorError(`region ${countryCode}-${regionCode} has a city with no name`);
        }
        names.push(name);
    }

    return names;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readText(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
}
