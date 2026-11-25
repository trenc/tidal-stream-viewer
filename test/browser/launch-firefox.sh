#!/usr/bin/env bash
# Launches a headless Firefox with Marionette for the browser acceptance
# suites. Always a brand-new, isolated profile (under the system temp dir, so
# nothing lands in the repository), with flags that stop Firefox phoning home.
#   1. kill any old instance,
#   2. wipe the profile directory,
#   3. write user.js with flags that stop Firefox downloading ~30 MB of
#      initial data (updates, telemetry, safebrowsing, remote settings, push,
#      region probes, prefetch) plus flags that disable the browser HTTP cache
#      so a Cache API miss truly goes to the network (faithful offline
#      testing),
#   4. launch headless with Marionette on port 2828.
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FIREFOX_BIN="${FIREFOX_BIN:-firefox-esr}"
PROFILE="${TMPDIR:-/tmp}/tidal-streams-viewer-ff-profile"
LOG="$PROFILE/firefox.log"

pgrep -x "$FIREFOX_BIN" | xargs -r kill -9 2>/dev/null || true
sleep 1

rm -rf "$PROFILE"
mkdir -p "$PROFILE"

cat > "$PROFILE/user.js" <<'PREFS'
// --- no background traffic from Mozilla endpoints -------------------------
user_pref("media.autoplay.default", 0);
user_pref("layout.css.prefers-color-scheme.content-override", 0);
user_pref("app.update.enabled", false);
user_pref("app.update.auto", false);
user_pref("app.update.service.enabled", false);
user_pref("app.update.staging.enabled", false);
// app.update.enabled is a no-op on current ESR; these two stop the update
// check itself (aus5.mozilla.org).
user_pref("app.update.disabledForTesting", true);
user_pref("app.update.url", "");
user_pref("toolkit.telemetry.enabled", false);
user_pref("toolkit.telemetry.unified", false);
user_pref("toolkit.telemetry.archive.enabled", false);
user_pref("datareporting.healthreport.uploadEnabled", false);
user_pref("datareporting.policy.dataSubmissionEnabled", false);
// The usage ping has its own switch (incoming.telemetry.mozilla.org still
// uploaded with policy.dataSubmissionEnabled=false).
user_pref("datareporting.usage.uploadEnabled", false);
// Web push (push.services.mozilla.com) and the newtab activity stream
// (wallpapers, ads, merino suggestions, OHTTP configs).
user_pref("dom.push.enabled", false);
user_pref("browser.newtabpage.enabled", false);
user_pref("browser.urlbar.merino.enabled", false);
user_pref("browser.urlbar.quicksuggest.enabled", false);
// The country probe uses this URL, not browser.region.update.
user_pref("browser.region.network.url", "");
// Widevine/GMP component updates via Google endpoints.
user_pref("media.gmp-manager.updateEnabled", false);
user_pref("media.gmp-manager.url", "");
user_pref("app.normandy.enabled", false);
user_pref("app.shield.optoutstudies.enabled", false);
user_pref("browser.safebrowsing.malware.enabled", false);
user_pref("browser.safebrowsing.phishing.enabled", false);
user_pref("browser.safebrowsing.downloads.enabled", false);
user_pref("browser.safebrowsing.update.enabled", false);
user_pref("browser.safebrowsing.provider.google.update_enabled", false);
user_pref("browser.safebrowsing.provider.google4.update_enabled", false);
user_pref("browser.safebrowsing.provider.mozilla.update_enabled", false);
user_pref("extensions.update.enabled", false);
user_pref("extensions.getAddons.cache.enabled", false);
user_pref("extensions.blocklist.enabled", false);
// Unreachable loopback address: the remote settings sync fails locally
// instead of downloading its attachments.
user_pref("services.settings.server", "http://127.0.0.1:1");
user_pref("network.captive-portal-service.enabled", false);
user_pref("network.connectivity-service.enabled", false);
user_pref("browser.region.update.enabled", false);
user_pref("browser.discovery.enabled", false);
user_pref("browser.uitour.enabled", false);
user_pref("network.prefetch-next", false);
user_pref("network.dns.disablePrefetch", true);
user_pref("network.predictor.enabled", false);

// --- faithful offline testing ----------------------------------------------
// No HTTP cache behind the service worker, so a Cache API miss truly has to
// go to the network (otherwise the disk cache masks deleted entries).
user_pref("browser.cache.disk.enable", false);
user_pref("browser.cache.memory.enable", false);
user_pref("browser.cache.disk.smart_size.enabled", false);
user_pref("network.http.cache.disk.enable", false);
user_pref("network.http.cache.memory.enable", false);
PREFS

HOME="$PROFILE" nohup "$FIREFOX_BIN" --headless --marionette --no-remote \
  --profile "$PROFILE" about:blank > "$LOG" 2>&1 &

for _ in $(seq 1 20); do
  pgrep -x "$FIREFOX_BIN" >/dev/null && break
  sleep 0.5
done
pgrep -x "$FIREFOX_BIN" >/dev/null || { echo "firefox did not start"; exit 1; }
echo "headless firefox running with a fresh profile (pid $(pgrep -x "$FIREFOX_BIN" | head -1))"
