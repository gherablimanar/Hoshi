#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
ENGINE_REV=133b558de556f0282f51c3f53f3b3fc633b4310a
DATABASE_REV=1512874ace50917e25ccf7d7df1f616b5f39a8b5
mkdir -p .upstream .tools
if [[ ! -d .upstream/openrocket ]]; then
  git clone --depth 1 --branch release-24.12 https://github.com/openrocket/openrocket.git .upstream/openrocket
fi
[[ "$(git -C .upstream/openrocket rev-parse HEAD)" == "$ENGINE_REV" ]] || { echo 'Wrong OpenRocket revision; refusing to mix releases.' >&2; exit 1; }
git -C .upstream/openrocket diff --quiet || { echo 'Upstream sources have local changes; inspect before building.' >&2; exit 1; }
git -C .upstream/openrocket submodule update --init --depth 1
[[ "$(git -C .upstream/openrocket/core/resources-src/datafiles/openrocket-database rev-parse HEAD)" == "$DATABASE_REV" ]] || { echo 'Wrong component database revision.' >&2; exit 1; }
if ! command -v javac >/dev/null && [[ ! -x .tools/jdk-21.0.5+11/bin/javac ]]; then
  [[ "$(uname -m)" == x86_64 && "$(uname -s)" == Linux ]] || { echo 'Install a JDK 17+ and set JAVA_HOME on this platform.' >&2; exit 1; }
  curl -fL --retry 2 https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.5%2B11/OpenJDK21U-jdk_x64_linux_hotspot_21.0.5_11.tar.gz -o .tools/jdk.tar.gz
  echo '3c654d98404c073b8a7e66bffb27f4ae3e7ede47d13284c132d40a83144bfd8c  .tools/jdk.tar.gz' | sha256sum -c -
  tar -xzf .tools/jdk.tar.gz -C .tools
fi
source scripts/java-env.sh
./gradlew :backend:installDist --no-daemon --max-workers=2
(cd frontend && npm ci --no-audit --no-fund && npm run build)
echo 'Built Rocket Designer. Start with ./scripts/start.sh; tests: ./scripts/test.sh'
