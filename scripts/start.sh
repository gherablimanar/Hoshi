#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
source scripts/java-env.sh
[[ -f frontend/dist/index.html && -x backend/build/install/backend/bin/backend ]] || { echo 'Run ./scripts/setup.sh first.' >&2; exit 1; }
# DATA_DIR is resolved relative to this repository unless an absolute path is supplied.
exec backend/build/install/backend/bin/backend
