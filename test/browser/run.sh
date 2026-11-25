#!/usr/bin/env bash
# Runs one browser acceptance suite against the served production build and
# cleans up afterwards, on success and on failure:
#   - the headless Firefox is killed,
#   - the webserver container is started again (the suites stop it to test
#     true offline behaviour),
#   - the throwaway profile is removed.
# Usage: test/browser/run.sh [acceptance|acceptance-offline]
set -uo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$DIR/../.." && pwd)"
FIREFOX_BIN="${FIREFOX_BIN:-firefox-esr}"
SUITE="${1:-acceptance}"

"$DIR/launch-firefox.sh"
FIREFOX_PID="$(pgrep -x "$FIREFOX_BIN" | head -1)"

cleanup() {
  [ -n "${FIREFOX_PID:-}" ] && kill "$FIREFOX_PID" 2>/dev/null || true
  docker compose -f "$ROOT/docker-compose.yml" start php >/dev/null 2>&1 || true
  rm -rf "${TMPDIR:-/tmp}/tidal-streams-viewer-ff-profile"
}
trap cleanup EXIT

node "$DIR/$SUITE.mjs"
