#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
mkdir -p build
# Include all upstream source, bundled data, adapter, UI, lockfiles, notices and build scripts.
# Never include credentials, private projects, cached dependencies or VCS authentication metadata.
tar --exclude='./.git' --exclude='*/.git' --exclude='./.tools' --exclude='./.gradle' --exclude='./data' --exclude='./.env' --exclude='*/node_modules' --exclude='*/build' --exclude='./frontend/dist' --exclude='./frontend/test-results' --exclude='./tests/*.png' -czf /tmp/rocket-designer-source.tar.gz .
mv /tmp/rocket-designer-source.tar.gz build/rocket-designer-source.tar.gz
printf '%s\n' "$ROOT/build/rocket-designer-source.tar.gz"
