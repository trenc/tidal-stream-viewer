# Browser acceptance suites

End-to-end checks against the **served production build** with a real service
worker — not mocked fetches. Two suites:

- `acceptance.mjs` — the download flow: two-tap download with exact size,
  Cancel/resume/Remove, cache contents after the download, offline opening
  with a manual tide, stepping and playback, the stale-error recovery, and
  narrow-viewport layout (320/375 px).
- `acceptance-offline.mjs` — what the viewer says when atlas data cannot be
  fetched offline: metadata absent, metadata cached but frames absent,
  partially cached atlas (requested frames missing), frames cached through
  browsing without an explicit download, and reconnection/recovery. Checks
  the rendered DOM (error box, map badges), not component state.

## Prerequisites

- The Docker webserver running (`make up`); it serves the production build.
  Build first: `make build`.
- `firefox-esr` (or `FIREFOX_BIN=<path>`) and Node ≥ 18 in the `PATH`.
- No API key needed: the suites use the manual reference tide.

## Run

```
test/browser/run.sh acceptance          # download, offline navigation, layout
test/browser/run.sh acceptance-offline  # offline-unavailability cases
```

The runner starts a headless Firefox with a **fresh, isolated profile** (under
the system temp dir, wiped after the run, never committed), runs the suite,
and then always cleans up: the browser is killed and the webserver container
is started again. Both suites intentionally `docker compose stop php` to test
true offline behaviour — the cleanup guarantees the webserver comes back even
when a suite fails.

## Why the browser HTTP cache is disabled

The profile's `user.js` turns off the browser HTTP cache (and Firefox's
background traffic: updates, telemetry, safebrowsing, remote settings, push,
region probes, prefetch). Without this, the disk cache silently serves frames
that were deleted from the Cache Storage API, which would mask exactly the
partial-download and cache-completeness bugs the suites look for. A phone at
sea has no warm HTTP cache either.

## Notes

- The suites drive the page through the same code paths as taps: clicking the
  real About/row buttons and calling the component's pick handler for atlas
  selection.
- The webserver on `http://localhost/` is the test server; `localhost` counts
  as a secure context, which the service worker requires.
- Generated profiles and logs live in the system temp dir (`browser.cache`
  flags, `user.js`, `firefox.log`) and are removed by the runner; nothing
  browser-related is committed.
