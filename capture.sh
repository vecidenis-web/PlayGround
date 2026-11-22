#!/usr/bin/env bash
set -euo pipefail
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"
: "${CAPTURE_URL:?Set CAPTURE_URL to the exact preview URL}"
: "${CAPTURE_DIR:?Set CAPTURE_DIR for screenshot evidence}"
: "${RUNTIME_DIR:?RUNTIME_DIR must point to the worker runtime}"
run() { /usr/bin/time -p "$@"; }
run node --version
run test -f "$RUNTIME_DIR/scripts/default-capture.mjs"
run mkdir -p "$CAPTURE_DIR"
export CAPTURE_STRICT=1
export CAPTURE_READY_SELECTOR="body"
export CAPTURE_START_SELECTOR="#startBtn"
# The runtime capture helper navigates to CAPTURE_URL, verifies rendering, captures both
# viewport sizes, and closes the Chromium instance it starts before returning.
run node "$RUNTIME_DIR/scripts/default-capture.mjs"
