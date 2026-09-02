import { mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, posix, relative, resolve, sep } from 'node:path';
import { promisify } from 'node:util';
import zlib from 'node:zlib';
import { COMPRESSION_CONCURRENCY, OUTPUT_DIR } from './config.js';
import { GeneratorError, describe } from './errors.js';
import type { Shard, ShardKind } from './shards.js';

// Pruning deletes files, so it only ever considers paths this generator itself emits.
// Anything else that lands under the output directory is left alone.
const MANAGED_SHARD_PATTERN = /^(countries\.json|regions\/[A-Z]{2}\.json|cities\/[A-Z]{2}-[A-Za-z0-9]{1,8}\.json)$/;

const brotliCompress = promisify(zlib.brotliCompress);
const gzipCompress = promisify(zlib.gzip);

export interface EmittedShard {
    kind: ShardKind;
    relativePath: string;
    jsonBytes: number;
    brotliBytes: number;
    gzipBytes: number;
}

export async function snapshotBrotliSizes(): Promise<Map<string, number>> {
    const sizes = new Map<string, number>();

    for (const relativePath of await listManagedShards()) {
        const absolute = join(OUTPUT_DIR, relativePath);
        const twin = await sizeOf(`${absolute}.br`);
        sizes.set(relativePath, twin ?? (await brotli(await readFile(absolute))).byteLength);
    }

    return sizes;
}

export async function emitShards(shards: readonly Shard[]): Promise<EmittedShard[]> {
    try {
        await Promise.all(
            [...new Set(shards.map((shard) => dirname(join(OUTPUT_DIR, shard.relativePath))))].map((directory) =>
                mkdir(directory, { recursive: true }),
            ),
        );

        return await mapWithConcurrency(shards, COMPRESSION_CONCURRENCY, async (shard) => {
            const absolute = join(OUTPUT_DIR, shard.relativePath);
            const [brotliBody, gzipBody] = await Promise.all([brotli(shard.body), gzipCompress(shard.body, { level: 9 })]);

            await Promise.all([
                writeFile(absolute, shard.body),
                writeFile(`${absolute}.br`, brotliBody),
                writeFile(`${absolute}.gz`, gzipBody),
            ]);

            return {
                kind: shard.kind,
                relativePath: shard.relativePath,
                jsonBytes: shard.body.byteLength,
                brotliBytes: brotliBody.byteLength,
                gzipBytes: gzipBody.byteLength,
            };
        });
    } catch (cause) {
        throw new GeneratorError(`could not write the shards into ${OUTPUT_DIR}: ${describe(cause)}`);
    }
}

export async function pruneStaleShards(emitted: readonly EmittedShard[]): Promise<string[]> {
    const keep = new Set(emitted.map((shard) => shard.relativePath));
    const removed: string[] = [];

    for (const relativePath of await listManagedShards()) {
        if (keep.has(relativePath)) {
            continue;
        }
        const absolute = join(OUTPUT_DIR, relativePath);
        await Promise.all([rm(absolute), rm(`${absolute}.br`, { force: true }), rm(`${absolute}.gz`, { force: true })]);
        removed.push(relativePath);
    }

    return removed.sort();
}

async function listManagedShards(): Promise<string[]> {
    let entries;
    try {
        entries = await readdir(OUTPUT_DIR, { withFileTypes: true, recursive: true });
    } catch {
        return [];
    }

    return entries
        .filter((entry) => entry.isFile())
        .map((entry) => toPosix(relative(OUTPUT_DIR, resolve(entry.parentPath, entry.name))))
        .filter((relativePath) => MANAGED_SHARD_PATTERN.test(relativePath))
        .sort();
}

function toPosix(value: string): string {
    return value.split(sep).join(posix.sep);
}

async function sizeOf(path: string): Promise<number | undefined> {
    try {
        return (await stat(path)).size;
    } catch {
        return undefined;
    }
}

function brotli(body: Buffer): Promise<Buffer> {
    return brotliCompress(body, {
        params: {
            [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT,
            [zlib.constants.BROTLI_PARAM_QUALITY]: zlib.constants.BROTLI_MAX_QUALITY,
            [zlib.constants.BROTLI_PARAM_SIZE_HINT]: body.byteLength,
        },
    });
}

async function mapWithConcurrency<T, R>(
    items: readonly T[],
    limit: number,
    worker: (item: T) => Promise<R>,
): Promise<R[]> {
    const results = new Array<R>(items.length);
    let cursor = 0;

    const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (cursor < items.length) {
            const index = cursor;
            cursor += 1;
            results[index] = await worker(items[index] as T);
        }
    });

    await Promise.all(runners);
    return results;
}
