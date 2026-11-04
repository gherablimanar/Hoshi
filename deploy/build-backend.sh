#!/usr/bin/env bash
set -euo pipefail
# Optional managed-cloud CA is used only during this build step; never copied into runtime layers.
TEMP_TRUST="$(mktemp -d)"
trap 'rm -rf "$TEMP_TRUST"' EXIT
if [[ -f /run/secrets/proxy_ca ]]; then
  cat /etc/ssl/certs/ca-certificates.crt /run/secrets/proxy_ca > "$TEMP_TRUST/ca.pem"
  export GIT_SSL_CAINFO="$TEMP_TRUST/ca.pem"
  cp "$JAVA_HOME/lib/security/cacerts" "$TEMP_TRUST/cacerts"
  keytool -importcert -noprompt -alias managed-build-proxy -file /run/secrets/proxy_ca -keystore "$TEMP_TRUST/cacerts" -storepass changeit >/dev/null
  export JAVA_TOOL_OPTIONS="${JAVA_TOOL_OPTIONS:-} -Djavax.net.ssl.trustStore=$TEMP_TRUST/cacerts"
fi
if [[ -n "${HTTPS_PROXY:-}" ]]; then
  PROXY_JAVA_FLAGS="$(node -e 'const u=new URL(process.env.HTTPS_PROXY);process.stdout.write(`-Dhttps.proxyHost=${u.hostname} -Dhttps.proxyPort=${u.port||80} -Dhttp.proxyHost=${u.hostname} -Dhttp.proxyPort=${u.port||80}`)')"
  export JAVA_TOOL_OPTIONS="${JAVA_TOOL_OPTIONS:-} $PROXY_JAVA_FLAGS"
fi
mkdir -p .upstream
git clone --depth 1 --branch release-24.12 https://github.com/openrocket/openrocket.git .upstream/openrocket
[[ "$(git -C .upstream/openrocket rev-parse HEAD)" == 133b558de556f0282f51c3f53f3b3fc633b4310a ]]
git -C .upstream/openrocket submodule update --init --depth 1
[[ "$(git -C .upstream/openrocket/core/resources-src/datafiles/openrocket-database rev-parse HEAD)" == 1512874ace50917e25ccf7d7df1f616b5f39a8b5 ]]
./gradlew :backend:installDist --no-daemon --max-workers=2 -Dorg.gradle.jvmargs=-Xmx768m
