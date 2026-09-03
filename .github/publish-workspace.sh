#!/usr/bin/env bash
set -euo pipefail

workspace="$1"
version="$(node -p "require('./packages/${workspace#@mb-digital/}/package.json').version")"

if npm view "${workspace}@${version}" version >/dev/null 2>&1; then
    echo "${workspace}@${version} is already on the registry, nothing to publish"
    exit 0
fi

npm publish --workspace "${workspace}" --provenance --access public
