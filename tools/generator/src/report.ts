import { MAX_CITY_SHARD_BROTLI_BYTES, OUTPUT_DIR, SIZE_DRIFT_THRESHOLD } from './config.js';
import type { EmittedShard } from './emit.js';
import type { ShardSet } from './shards.js';

const PERCENTILES = [0.5, 0.75, 0.9, 0.95, 0.99] as const;
const LARGEST_SHARDS_SHOWN = 10;
const DRIFT_ROWS_SHOWN = 20;

export interface ReportInput {
    shardSet: ShardSet;
    emitted: EmittedShard[];
    previousBrotliSizes: Map<string, number>;
    pruned: string[];
    elapsedMs: number;
}

export function printReport(input: ReportInput): void {
    const { shardSet, emitted, previousBrotliSizes, pruned, elapsedMs } = input;
    const cityShards = emitted.filter((shard) => shard.kind === 'cities');
    const brotliSizes = cityShards.map((shard) => shard.brotliBytes).sort((a, b) => a - b);
    const lines: string[] = [];

    lines.push('');
    lines.push(`geo-data v1 build report  (${OUTPUT_DIR})`);
    lines.push('');
    lines.push('counts');
    lines.push(row('countries', shardSet.countryCount));
    lines.push(row('regions', shardSet.regionCount));
    lines.push(row('cities', shardSet.cityCount));
    lines.push(row('region shards', emitted.filter((shard) => shard.kind === 'regions').length));
    lines.push(row('city shards', cityShards.length));
    lines.push(row('duplicate cities dropped', shardSet.droppedDuplicateCities));
    lines.push('');
    lines.push('total bytes');
    lines.push(row('json', formatBytes(sum(emitted.map((shard) => shard.jsonBytes)))));
    lines.push(row('brotli', formatBytes(sum(emitted.map((shard) => shard.brotliBytes)))));
    lines.push(row('gzip', formatBytes(sum(emitted.map((shard) => shard.gzipBytes)))));
    lines.push('');
    lines.push('city shard size distribution (brotli)');
    for (const fraction of PERCENTILES) {
        lines.push(row(`p${fraction * 100}`, formatBytes(percentile(brotliSizes, fraction))));
    }
    lines.push(row('max', formatBytes(brotliSizes.at(-1) ?? 0)));
    lines.push(row('gate', formatBytes(MAX_CITY_SHARD_BROTLI_BYTES)));
    lines.push('');
    lines.push(`largest ${LARGEST_SHARDS_SHOWN} city shards (brotli)`);
    for (const shard of [...cityShards].sort((a, b) => b.brotliBytes - a.brotliBytes).slice(0, LARGEST_SHARDS_SHOWN)) {
        lines.push(
            `  ${shard.relativePath.padEnd(24)}${formatBytes(shard.brotliBytes).padStart(9)}   json ${formatBytes(shard.jsonBytes).padStart(9)}`,
        );
    }

    lines.push(...diffLines(emitted, previousBrotliSizes, pruned));
    lines.push('');
    lines.push(`built in ${(elapsedMs / 1000).toFixed(1)}s`);
    lines.push('');

    process.stdout.write(`${lines.join('\n')}\n`);
}

function diffLines(
    emitted: readonly EmittedShard[],
    previous: Map<string, number>,
    pruned: readonly string[],
): string[] {
    const lines: string[] = ['', 'diff against previous run'];

    if (previous.size === 0) {
        lines.push('  no previous output found');
        return lines;
    }

    const added: string[] = [];
    const drifted: { relativePath: string; before: number; after: number }[] = [];

    for (const shard of emitted) {
        const before = previous.get(shard.relativePath);
        if (before === undefined) {
            added.push(shard.relativePath);
            continue;
        }
        if (before === 0 || Math.abs(shard.brotliBytes - before) / before > SIZE_DRIFT_THRESHOLD) {
            drifted.push({ relativePath: shard.relativePath, before, after: shard.brotliBytes });
        }
    }

    lines.push(row('added', added.length));
    lines.push(row('removed', pruned.length));
    lines.push(row(`size drift >${(SIZE_DRIFT_THRESHOLD * 100).toFixed(0)}%`, drifted.length));

    for (const relativePath of added.slice(0, DRIFT_ROWS_SHOWN)) {
        lines.push(`  + ${relativePath}`);
    }
    for (const relativePath of pruned.slice(0, DRIFT_ROWS_SHOWN)) {
        lines.push(`  - ${relativePath}`);
    }
    for (const entry of drifted
        .sort((a, b) => Math.abs(b.after - b.before) - Math.abs(a.after - a.before))
        .slice(0, DRIFT_ROWS_SHOWN)) {
        const delta = ((entry.after - entry.before) / entry.before) * 100;
        lines.push(
            `  ~ ${entry.relativePath.padEnd(24)}${formatBytes(entry.before)} -> ${formatBytes(entry.after)} (${delta > 0 ? '+' : ''}${delta.toFixed(1)}%)`,
        );
    }

    const hidden =
        Math.max(0, added.length - DRIFT_ROWS_SHOWN) +
        Math.max(0, pruned.length - DRIFT_ROWS_SHOWN) +
        Math.max(0, drifted.length - DRIFT_ROWS_SHOWN);
    if (hidden > 0) {
        lines.push(`  ... and ${hidden} more`);
    }

    return lines;
}

function row(label: string, value: string | number): string {
    return `  ${label.padEnd(26)}${String(value)}`;
}

function percentile(sortedAscending: readonly number[], fraction: number): number {
    if (sortedAscending.length === 0) {
        return 0;
    }
    const rank = Math.ceil(fraction * sortedAscending.length);
    const index = Math.min(sortedAscending.length - 1, Math.max(0, rank - 1));
    return sortedAscending[index] ?? 0;
}

function sum(values: readonly number[]): number {
    return values.reduce((total, value) => total + value, 0);
}

export function formatBytes(bytes: number): string {
    if (bytes < 1024) {
        return `${bytes} B`;
    }
    if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
