// Upload the generated shards to S3.
//
// The metadata here is not cosmetic. S3 does not negotiate content encodings, so the CDN serves
// whichever object the edge function selected and the browser trusts Content-Encoding to know what
// it received. A .br object uploaded without `Content-Encoding: br` reaches the client as compressed
// bytes labelled application/json, and every consumer fails to parse it — with no error at the CDN
// layer to point at. That is why the twins are uploaded in separate passes rather than one sweep.
//
// Usage:
//   node scripts/upload-shards.mjs --bucket mbdigital-prod-geo [--profile cg-triage] [--dry-run]

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const source = path.join(root, 'packages', 'geo-data', 'v1')

const args = process.argv.slice(2)
const flag = name => {
  const i = args.indexOf(`--${name}`)
  return i === -1 ? undefined : args[i + 1]
}

const bucket = flag('bucket')
const profile = flag('profile')
const dryRun = args.includes('--dry-run')

if (!bucket) {
  console.error('error: --bucket is required')
  process.exit(1)
}

if (!fs.existsSync(source)) {
  console.error(`error: no shards at ${source} — run \`npm run generate\` first`)
  process.exit(1)
}

// Immutable for a year. Safe only because the version lives in the path: a breaking shape change
// ships as /v2 alongside /v1 rather than overwriting anything.
const CACHE_CONTROL = 'public, max-age=31536000, immutable'

const passes = [
  { include: '*.json', encoding: null, label: 'identity' },
  { include: '*.json.br', encoding: 'br', label: 'brotli' },
  { include: '*.json.gz', encoding: 'gzip', label: 'gzip' }
]

const count = pattern => {
  const suffix = pattern.replace('*', '')
  let n = 0
  const walk = dir => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (entry.name.endsWith(suffix)) n++
    }
  }
  walk(source)
  return n
}

for (const pass of passes) {
  const files = count(pass.include)

  if (files === 0) {
    console.error(`error: no ${pass.label} files matched ${pass.include}`)
    console.error('the compressed twins are generated, not committed — run `npm run generate` first')
    process.exit(1)
  }

  const argv = [
    's3',
    'cp',
    source,
    `s3://${bucket}/v1`,
    '--recursive',
    '--exclude',
    '*',
    '--include',
    pass.include,
    '--content-type',
    'application/json',
    '--cache-control',
    CACHE_CONTROL,
    '--only-show-errors'
  ]

  if (pass.encoding) argv.push('--content-encoding', pass.encoding)
  if (profile) argv.push('--profile', profile)
  if (dryRun) argv.push('--dryrun')

  console.log(`${pass.label.padEnd(8)} ${String(files).padStart(5)} files -> s3://${bucket}/v1`)

  execFileSync('aws', argv, { stdio: 'inherit' })
}

console.log('')
console.log('done. verify through the CDN, not the bucket:')
console.log("  curl -sI -H 'Accept-Encoding: br' https://geo.revenuerush.com/v1/regions/US.json")
console.log('  expect 200, content-encoding: br, the immutable cache-control, and no set-cookie')
