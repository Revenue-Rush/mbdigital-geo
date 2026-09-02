import type { ShardSet } from './shards.js';

/**
 * Facts about the emitted data that must hold on every run.
 *
 * The upstream dataset is refreshed roughly monthly by people we do not control, and a territorial
 * regression there would otherwise land in two products silently. These assertions fail the build
 * instead. They are not opinions about the data — each one restates who actually administers a
 * territory, which is also what an address form has to get right to be deliverable.
 */

interface Invariant {
    description: string;
    check: (regions: Map<string, [string, string, boolean][]>, countries: Set<string>) => string | null;
}

const owns = (
    regions: Map<string, [string, string, boolean][]>,
    country: string,
    needle: string,
): boolean => (regions.get(country) ?? []).some(([, name]) => name.toLowerCase().includes(needle.toLowerCase()));

export const INVARIANTS: Invariant[] = [
    {
        description: 'Crimea and Sevastopol are listed under Ukraine',
        check: (regions) =>
            owns(regions, 'UA', 'Crimea') && owns(regions, 'UA', 'Sevastopol')
                ? null
                : 'UA is missing Crimea or Sevastopol',
    },
    {
        description: 'Russia claims none of Ukraine',
        check: (regions) => {
            const claimed = ['Crimea', 'Sevastopol', 'Donets', 'Luhans', 'Zapor', 'Kherson'].filter((name) =>
                owns(regions, 'RU', name),
            );

            return claimed.length === 0 ? null : `RU lists Ukrainian territory: ${claimed.join(', ')}`;
        },
    },
    {
        description: 'Ukraine keeps all 27 first-level subdivisions',
        check: (regions) => {
            const count = (regions.get('UA') ?? []).length;

            return count === 27 ? null : `UA has ${count} regions, expected 27`;
        },
    },
    {
        description: 'Taiwan is a country, not a Chinese province',
        check: (regions, countries) => {
            if (!countries.has('TW')) return 'TW is missing from the country index';

            return owns(regions, 'CN', 'Taiwan') ? 'CN lists Taiwan as a subdivision' : null;
        },
    },
    {
        description: 'Hong Kong and Macau are addressed as themselves, not as Chinese provinces',
        check: (regions, countries) => {
            if (!countries.has('HK') || !countries.has('MO')) return 'HK or MO is missing from the country index';

            const claimed = ['Hong Kong', 'Macau', 'Macao'].filter((name) => owns(regions, 'CN', name));

            return claimed.length === 0 ? null : `CN lists ${claimed.join(', ')} as subdivisions`;
        },
    },
    {
        description: 'Kosovo is addressed under XK, not as Serbian districts',
        check: (regions, countries) => {
            if (!countries.has('XK')) return 'XK is missing from the country index';

            return owns(regions, 'RS', 'Kosov') ? 'RS lists Kosovo districts as subdivisions' : null;
        },
    },
    {
        description: 'Palestine and Israel are separate country entries',
        check: (_regions, countries) =>
            countries.has('PS') && countries.has('IL') ? null : 'PS or IL is missing from the country index',
    },
];

export function checkInvariants(shardSet: ShardSet): string[] {
    const regions = new Map<string, [string, string, boolean][]>();

    for (const shard of shardSet.shards) {
        const match = /^regions\/([A-Z]{2})\.json$/.exec(shard.relativePath);
        if (!match?.[1]) continue;

        regions.set(
            match[1],
            (JSON.parse(shard.body.toString('utf8')) as { regions: [string, string, boolean][] }).regions,
        );
    }

    const countries = new Set(shardSet.countries.map(([code]) => code));

    return INVARIANTS.map((invariant) => {
        const failure = invariant.check(regions, countries);

        return failure ? `${invariant.description} — ${failure}` : null;
    }).filter((line): line is string => line !== null);
}
