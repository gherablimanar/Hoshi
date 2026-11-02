#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
source scripts/java-env.sh
./gradlew :backend:test :backend:upstreamTest --no-daemon --max-workers=2
(cd frontend && npm run build)
# Start scripts/start.sh in a separate terminal before RUN_BROWSER_TESTS=1.
if [[ "${RUN_BROWSER_TESTS:-0}" == 1 ]]; then (cd frontend && npm run test:e2e); fi
