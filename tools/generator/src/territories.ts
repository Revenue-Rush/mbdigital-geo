/**
 * Subdivisions the upstream dataset lists under a parent that does not administer them.
 *
 * The test applied here is administrative and postal, not aspirational: does the parent state
 * actually run the territory, and would an address there be written and delivered as part of the
 * parent? Where the answer is no, the territory keeps its own ISO 3166-1 entry — which it already
 * has, with its own regions and cities — and is removed from the parent's subdivision list.
 *
 * What is deliberately NOT removed:
 *
 *   - French overseas départements (Guadeloupe, Martinique, Mayotte, French Guiana, Saint Pierre
 *     and Miquelon, French Polynesia) and US territories (Puerto Rico, Guam, American Samoa,
 *     Northern Mariana Islands). These are administered by, and addressed through, their parent:
 *     USPS accepts PR and GU as state codes, and a Martinique address is a French postal address.
 *     Removing them would break address entry for people who live there.
 *
 *   - Name collisions that are not territorial at all: Georgia the US state, Niger State in
 *     Nigeria, Mali prefecture in Guinea, Luxembourg province in Belgium.
 *
 * Every entry is keyed by parent + subdivision code, never by name, so a collision can never
 * remove the wrong row.
 */
export interface RemovedSubdivision {
    country: string;
    region: string;
    reason: string;
}

export const NOT_ADMINISTERED_BY_PARENT: RemovedSubdivision[] = [
    {
        country: 'CN',
        region: 'TW',
        reason: 'Taiwan is not administered by the PRC and does not use Chinese postal addressing; it is ISO 3166-1 TW',
    },
    {
        country: 'CN',
        region: 'HK',
        reason: 'Hong Kong has its own government, immigration and postal system; it is ISO 3166-1 HK',
    },
    {
        country: 'CN',
        region: 'MO',
        reason: 'Macau has its own government and postal system; it is ISO 3166-1 MO',
    },
    // The upstream data carries the Serbian administrative division of Kosovo — the province plus
    // its five districts. All six ship with zero cities, so they render as empty dropdowns, while
    // Kosovo's own ISO entry (XK) carries seven populated regions under the names actually used
    // there. Keeping both would offer a Serbian address form five dead options.
    { country: 'RS', region: 'KM', reason: 'Kosovo-Metohija: administered separately under UNSCR 1244; ISO 3166 user-assigned XK' },
    { country: 'RS', region: '25', reason: 'Kosovo district: administered separately under UNSCR 1244; ISO 3166 user-assigned XK' },
    { country: 'RS', region: '26', reason: 'Peć district: within Kosovo, listed under XK as Peja' },
    { country: 'RS', region: '27', reason: 'Prizren district: within Kosovo, listed under XK' },
    { country: 'RS', region: '28', reason: 'Kosovska Mitrovica district: within Kosovo, listed under XK as Mitrovica' },
    { country: 'RS', region: '29', reason: 'Kosovo-Pomoravlje district: within Kosovo, listed under XK as Gjilan' },
];

const key = (country: string, region: string) => `${country}/${region}`;

const removals = new Map(NOT_ADMINISTERED_BY_PARENT.map((entry) => [key(entry.country, entry.region), entry]));

export function isAdministeredByParent(country: string, region: string): boolean {
    return !removals.has(key(country, region));
}

export function removalFor(country: string, region: string): RemovedSubdivision | undefined {
    return removals.get(key(country, region));
}
