import { SCHEMA_VERSION } from './config.js';
import { isAdministeredByParent, removalFor } from './territories.js';
import type { SourceCountry } from './source.js';

export type ShardKind = 'countries' | 'regions' | 'cities';

export interface Shard {
    kind: ShardKind;
    relativePath: string;
    body: Buffer;
}

export interface ShardSet {
    shards: Shard[];
    countries: [string, string, boolean][];
    removedSubdivisions: string[];
    countryCount: number;
    regionCount: number;
    cityCount: number;
    droppedDuplicateCities: number;
}

const collator = new Intl.Collator('en');

// Collator.compare returns 0 for strings that differ only by ignorable characters, which would
// leave the order dependent on the input file. The code-unit fallback keeps the sort total.
function compareNames(a: string, b: string): number {
    const byCollation = collator.compare(a, b);
    if (byCollation !== 0) {
        return byCollation;
    }
    return a < b ? -1 : a > b ? 1 : 0;
}

export function buildShards(countries: SourceCountry[]): ShardSet {
    const shards: Shard[] = [];
    const countryRows: [string, string, boolean][] = [];

    let regionCount = 0;
    const removedSubdivisions: string[] = [];
    let cityCount = 0;
    let droppedDuplicateCities = 0;

    const orderedCountries = [...countries].sort(
        (a, b) => compareNames(a.name, b.name) || compareNames(a.code, b.code),
    );

    for (const country of orderedCountries) {
        const orderedRegions = [...country.regions].sort(
            (a, b) => compareNames(a.name, b.name) || compareNames(a.code, b.code),
        );
        const regionRows: [string, string, boolean][] = [];

        for (const region of orderedRegions) {
            if (!isAdministeredByParent(country.code, region.code)) {
                removedSubdivisions.push(
                    `${country.code}/${region.code} ${region.name} — ${removalFor(country.code, region.code)?.reason ?? ''}`,
                );
                continue;
            }

            const uniqueCities = new Set(region.cities);
            droppedDuplicateCities += region.cities.length - uniqueCities.size;

            const cities = [...uniqueCities].sort(compareNames);
            if (cities.length > 0) {
                shards.push({
                    kind: 'cities',
                    relativePath: `cities/${country.code}-${region.code}.json`,
                    body: serialise({
                        v: SCHEMA_VERSION,
                        country: country.code,
                        region: region.code,
                        cities,
                    }),
                });
                cityCount += cities.length;
            }

            regionRows.push([region.code, region.name, cities.length > 0]);
            regionCount += 1;
        }

        if (regionRows.length > 0) {
            shards.push({
                kind: 'regions',
                relativePath: `regions/${country.code}.json`,
                body: serialise({ v: SCHEMA_VERSION, country: country.code, regions: regionRows }),
            });
        }

        countryRows.push([country.code, country.name, regionRows.length > 0]);
    }

    shards.push({
        kind: 'countries',
        relativePath: 'countries.json',
        body: serialise({ v: SCHEMA_VERSION, countries: countryRows }),
    });

    shards.sort((a, b) => (a.relativePath < b.relativePath ? -1 : a.relativePath > b.relativePath ? 1 : 0));

    return {
        shards,
        countries: countryRows,
        removedSubdivisions,
        countryCount: countryRows.length,
        regionCount,
        cityCount,
        droppedDuplicateCities,
    };
}

function serialise(payload: unknown): Buffer {
    return Buffer.from(JSON.stringify(payload), 'utf8');
}
