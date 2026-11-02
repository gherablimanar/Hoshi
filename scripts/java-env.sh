#!/usr/bin/env bash
# Source this from scripts, keeping the platform's CA trust and proxy intact.
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ -d "$ROOT/.tools/jdk-21.0.5+11" ]]; then
  export JAVA_HOME="$ROOT/.tools/jdk-21.0.5+11"
  export PATH="$JAVA_HOME/bin:$PATH"
fi
if [[ -f /etc/ssl/certs/java/cacerts ]]; then
  export JAVA_TOOL_OPTIONS="${JAVA_TOOL_OPTIONS:-} -Djavax.net.ssl.trustStore=/etc/ssl/certs/java/cacerts"
fi
if [[ -n "${HTTPS_PROXY:-}" ]]; then
  PROXY_JAVA_FLAGS="$(node -e 'const u=new URL(process.env.HTTPS_PROXY); process.stdout.write(`-Dhttps.proxyHost=${u.hostname} -Dhttps.proxyPort=${u.port||80} -Dhttp.proxyHost=${u.hostname} -Dhttp.proxyPort=${u.port||80} -Dhttp.nonProxyHosts=localhost\u007c127.*`)')"
  export JAVA_TOOL_OPTIONS="${JAVA_TOOL_OPTIONS:-} $PROXY_JAVA_FLAGS"
fi
