import { MAX_CITY_SHARD_BROTLI_BYTES } from './config.js';
import { emitShards, pruneStaleShards, snapshotBrotliSizes } from './emit.js';
import { GeneratorError, describe } from './errors.js';
import { formatBytes, printReport } from './report.js';
import { buildShards } from './shards.js';
import { loadSource } from './source.js';

async function main(): Promise<number> {
    const startedAt = Date.now();
    const refresh = process.argv.includes('--refresh');

    const countries = await loadSource(refresh);
    const shardSet = buildShards(countries);

    const previousBrotliSizes = await snapshotBrotliSizes();
    const emitted = await emitShards(shardSet.shards);
    const pruned = await pruneStaleShards(emitted);

    printReport({ shardSet, emitted, previousBrotliSizes, pruned, elapsedMs: Date.now() - startedAt });

    const oversized = emitted
        .filter((shard) => shard.kind === 'cities' && shard.brotliBytes > MAX_CITY_SHARD_BROTLI_BYTES)
        .sort((a, b) => b.brotliBytes - a.brotliBytes);

    if (oversized.length > 0) {
        process.stderr.write(
            `error: ${oversized.length} city shard(s) exceed the ${formatBytes(MAX_CITY_SHARD_BROTLI_BYTES)} brotli budget:\n`,
        );
        for (const shard of oversized) {
            process.stderr.write(`  ${shard.relativePath} ${formatBytes(shard.brotliBytes)}\n`);
        }
        process.stderr.write('the sharding design has to change; do not raise the budget to make this pass\n');
        return 1;
    }

    return 0;
}

try {
    process.exitCode = await main();
} catch (error) {
    process.exitCode = 1;
    if (error instanceof GeneratorError) {
        process.stderr.write(`error: ${describe(error)}\n`);
    } else {
        process.stderr.write('error: the generator failed unexpectedly\n');
        console.error(error);
    }
}
