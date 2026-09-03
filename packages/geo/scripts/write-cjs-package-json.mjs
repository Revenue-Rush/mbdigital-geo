import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const target = resolve(packageRoot, 'dist/cjs/package.json')

await mkdir(dirname(target), { recursive: true })
await writeFile(target, `${JSON.stringify({ type: 'commonjs' }, null, 2)}\n`, 'utf8')
