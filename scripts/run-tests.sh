#!/usr/bin/env bash
set -euo pipefail

# Configure proxy settings (used in this environment for outbound HTTP(S))
export HTTP_PROXY="${HTTP_PROXY:-http://proxy:8080}"
export HTTPS_PROXY="${HTTPS_PROXY:-http://proxy:8080}"
export NO_PROXY="${NO_PROXY:-localhost,127.0.0.1,::1}"

# Allow Node to trust the proxy's certificate
export NODE_EXTRA_CA_CERTS="${NODE_EXTRA_CA_CERTS:-/usr/local/share/ca-certificates/envoy-mitmproxy-ca-cert.crt}"

# Nightscout test server (expects NIGHTSCOUT_URL with token to be set)
export NIGHTSCOUT_URL="${NIGHTSCOUT_URL:?NIGHTSCOUT_URL is required}"

# Quick connectivity check (fails if token invalid)
if curl -fsSL "${NIGHTSCOUT_URL%/}/api/v1/status" >/dev/null; then
  echo "Nightscout reachable"
else
  echo "Unable to reach Nightscout server" >&2
  exit 1
fi

# Run tests
npm test
