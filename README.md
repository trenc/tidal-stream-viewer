# Tidal Stream Viewer

An offline-capable web app for sailors that draws the **Shom tidal stream atlases** as arrows on a map and times them against the tide of a reference port. Pick an atlas, slide through the tidal cycle, and the viewer shows the stream for the matching hour, blended between neap and spring according to the tide coefficient.

Live at <https://tidalstreams.sailingpathways.com/>. Free, no ads, no cookies. Available in English, French and German.

> **Not for navigation on its own.** Shom states that the atlases may only be used together with the official charts and nautical publications. The values shown are derived estimates, not the values published by Shom. See [Data and licences](#data-and-licences).

## Contents

- [How it works](#how-it-works)
- [Shareable links](#shareable-links)
- [Project layout](#project-layout)
- [Requirements](#requirements)
- [Quick start](#quick-start)
- [Make targets](#make-targets)
- [Configuration](#configuration)
- [Atlas data](#atlas-data)
- [Tide proxy](#tide-proxy)
- [Analytics (optional)](#analytics-optional)
- [Progressive web app and iOS assets](#progressive-web-app-and-ios-assets)
- [Offline atlases](#offline-atlases)
- [Deployment](#deployment)
- [Versioning](#versioning)
- [Testing](#testing)
- [Privacy](#privacy)
- [Data and licences](#data-and-licences)

## How it works

1. **Atlas data.** Shom publishes 2D tidal current atlases as NetCDF files. A converter turns them into compact binary frames plus an `index.json`, which are served as static files under `/atlas`.
2. **Tide times.** The browser asks the site's own PHP proxy for the high and low waters and the height curve of the reference port. The proxy talks to [api-maree.fr](https://api-maree.fr/), keeps the API key on the server, caches the answers and enforces usage limits.
3. **Timing the stream.** For a chosen clock time the app picks the nearest reference tide and the matching atlas frame (`src/tide-plan.js`). The atlases contain two published cases (tide coefficients 45 and 95); arrows are interpolated linearly between them. Coefficients are limited to 20 to 120, and outside 45 to 95 the values are extrapolated, which is less reliable. If a tide has no coefficient, 70 is assumed and the app says so.
4. **Offline use.** A service worker caches the app, the atlas data and the map tiles that were already loaded, so the viewer keeps working without a connection. Each atlas can also be downloaded explicitly (see [Offline atlases](#offline-atlases)).

## Shareable links

The address bar always describes what is on screen: the selected atlas, the map centre, the zoom and the time marker. Copy the URL to share that exact view, or open such a link to restore it.

```text
https://tidalstreams.sailingpathways.com/#a=atlasdyn-surf-telemac3d-surf-r1111100-iroise-560-250m-5min&lat=48.3904&lon=-4.4861&zoom=10&t=2026-11-23T11:30Z
```

| Parameter | Meaning |
|---|---|
| `a` | Atlas id from `index.json` |
| `lat`, `lon` | Map centre with four decimals; written and read as a pair |
| `zoom` | Map zoom, 0 to 18 |
| `t` | Time marker in UTC, `YYYY-MM-DDTHH:mmZ` |

A link means the same moment in every time zone. Only the parts that are present and valid are restored; anything else is ignored and the app starts normally, showing the atlas areas. A time outside the seven-day range is clamped to the nearest allowed time. If the atlas id is no longer in the atlas index, the app also falls back to the atlas areas.

The app rewrites the hash with `history.replaceState` at most every 500 ms, so moving the timeline or the map does not fill the browser history with entries. Links written by the app only contain `t` for tidal atlases. The hash is read when the app starts, so reload the page after editing it by hand.

## Project layout

| Path | Purpose |
|---|---|
| `index.html` | The single page; the About dialog's texts live with the translations in `src/locales/` |
| `src/` | Front-end modules: `main.js` (entry and browser wiring), `viewer.js` (Alpine component), `map.js` (Leaflet), `session.js`, `tide-plan.js`, `timeline.js`, `playback.js`, `url-state.js` (shareable URL hash), `tides.js` and `tide-service.js` (tide API client), `update-flow.js` (update prompt rules), `atlas.js`, `frame-store.js`, `netcdf.js`, the translations (`en`, `fr`, `de`) and `style.css` |
| `public/` | Static files copied as they are: `app-icons/`, `splash/` (iOS launch images) |
| `public_html/` | The web root served by the local container and the source of the API upload. `make build` writes the app here |
| `public_html/api/` | PHP: `tides.php` (tide proxy), `m.php` (Plausible proxy), `env.php` (settings reader) |
| `public_html/atlas/` | Converted atlas data and `index.json` (never touched by `make build`) |
| `nc/` | The original Shom `.nc` files (input for the converter) |
| `scripts/` | `convert_atlas.py`, `make_ios_assets.py`, `deploy.sh` |
| `cache/tides/` | Local cache of the tide proxy |
| `dist/` | Vite build output (temporary) |

## Requirements

- Node.js 18 or newer and npm
- Docker with the Compose plugin. It runs the local server, the atlas converter and the iOS asset script
- `rsync` (used by `make build`) and `lftp` (used by the deploy script): `sudo apt install rsync lftp`
- An [api-maree.fr](https://api-maree.fr/) API key
- For hosting: Webserver with PHP 8.1 or newer and the cURL extension, plus FTP access

`docker-compose.yml` starts a service called `php` from a `serversideup/php:8.5-fpm-nginx` image (nginx with PHP 8.5).

## Quick start

```bash
make setup      # creates folders and .env, fixes cache permissions (asks for sudo once)
# add your MAREE_API_KEY to .env
make install    # npm install
make up         # starts the webserver and PHP container (ports 80 and 443)
make convert    # put the Shom .nc files into nc/ first
make dev        # Vite dev server on http://localhost:5173/
```

In development, Vite proxies `/atlas` and `/api` to the webserver container, so the app, the atlas data and the tide proxy behave as they do in production.

To produce the production build into `public_html/`:

```bash
make build
make check      # prints HTTP status codes for app, manifest, service worker, atlas index and tide proxy
```

## Make targets

Run `make help` for the current list.

| Target | What it does |
|---|---|
| `setup` | Create folders and `.env`, fix cache permissions |
| `install` | Install npm dependencies |
| `dev` | Start webserver, then the Vite dev server |
| `build` | Build into `dist/` and copy into `public_html/` (keeps `atlas/` and `api/`) |
| `preview` | Preview the production build with Vite |
| `test` | Run all unit tests |
| `up`, `down`, `restart`, `logs`, `shell` | Manage the webserver/PHP container (`restart` is needed after changing `.env`) |
| `convert` | Convert all `.nc` files in `nc/` into `public_html/atlas` |
| `reindex` | Rebuild the `index.json` entries from the atlas folders |
| `ios-assets` | Create the iOS launch screens from the app icon (needs Docker) |
| `bump` | Raise the version (`BUMP=patch\|minor\|major`), commit and tag |
| `deploy-dry` | Show what an FTP deploy would change, upload nothing |
| `deploy` | Build and upload the app (asks before uploading) |
| `deploy-all` | Upload app, tide proxy and atlas data |
| `check` | HTTP status check of the local installation |
| `clean`, `clean-cache` | Remove `dist/`, empty the tide proxy cache |

`make build` deletes everything in `public_html/` that is not part of the build, except `atlas/` and `api/`. Put extra static files in `public/`. To preview what would change: `make build RSYNC_FLAGS="--dry-run --itemize-changes"`.

## Configuration

Settings are read from the process environment first, then from a `.env` file, by `public_html/api/env.php`. Locally Docker passes `MAREE_API_KEY` and sets `TIDE_CACHE_DIR` to `/var/cache/tides`. On the server, put a `.env` file in the folder above the document root. Copy `.env.example` to start.

| Variable | Used by | Purpose |
|---|---|---|
| `MAREE_API_KEY` | `tides.php` | api-maree.fr key (required) |
| `MAREE_API_KEY_FILE` | `tides.php` | Alternative: path to a file that contains the key |
| `TIDE_CACHE_DIR` | `tides.php`, `m.php` | Cache folder; a relative path is resolved from the folder above the document root |
| `TIDE_IP_HOURLY_BUDGET` | `tides.php` | Upstream calls per visitor address and hour (default 30) |
| `TIDE_HOURLY_BUDGET` | `tides.php` | Upstream calls for the whole site per hour (default 300) |
| `PLAUSIBLE_SCRIPT_URL` | `m.php` | Your Plausible script address; analytics are off without it |
| `PLAUSIBLE_DEBUG` | `m.php` | Set to `1` temporarily to see what Plausible answers |

Deployment settings (FTP host, user, password, remote folder and options) go into `.env.deploy`; copy `.env.deploy.example`. Both `.env` and `.env.deploy` are in `.gitignore`: never commit them.

## Atlas data

1. Download the Shom atlases (see [Data and licences](#data-and-licences)) and put the `.nc` files into `nc/`.
2. Run `make convert`. The converter runs in a throwaway Python container (`xarray`, `netCDF4`, `numpy`) and writes everything to `public_html/atlas/`.
3. After adding or removing atlas folders by hand, run `make reindex`.
4. Upload with `make deploy-all`.

For each file the converter writes a folder named after the file, with a `meta.json` (grid, coefficients, time offsets, reference port, release date) and one `f_c{coefficient}_t{time}.bin` frame per coefficient case and time step. A frame stores the east and north current components as 16-bit integers (0.001 m/s steps, `-32768` marks land). The shared `index.json` lists every atlas with its label, version, bounding box and grid size. The URL of every atlas file carries the version, so a re-converted atlas replaces the cached copy.

The converter accepts regular latitude and longitude grids with tidal time axes (origin 1950-01-01) and refuses curvilinear grids. The reference port and whether it is a high or low water come from the file's attributes. The index can also hold entries of other kinds, which the converter leaves alone.

## Tide proxy

`public_html/api/tides.php` is a small read-only JSON API in front of api-maree.fr.

- **Endpoints:** `/api/tides.php/sites`, `/api/tides.php/tide-extrema` and `/api/tides.php/water-levels`.
- **Validation:** only known site ids, whole UTC days, steps of 1, 5, 10, 15, 20, 30 or 60 minutes, at most 1500 heights per request and a date window of about 30 days either side of today.
- **Cache:** answers are kept in `TIDE_CACHE_DIR` (sites for 7 days, extrema and water levels for 1 day). Many users share the same cached windows. An hourly cleanup removes old files.
- **Quotas:** upstream calls are counted per visitor network and globally per UTC hour (defaults 30 and 300), so no address and not the account can exhaust the api-maree.fr limit. Addresses are only stored in scrambled (hashed) form, for a few hours. IPv6 visitors are counted per /64 network.
- **Access:** GET only, and browsers must state that the request comes from the site itself (`Sec-Fetch-Site`). The API key never reaches the browser and is masked in any upstream answer. Errors are logged, never printed.

## Analytics (optional)

The site can count visits with [Plausible Analytics](https://plausible.io/), cookie-free and through a first-party proxy so that the browser only talks to this site.

- `index.html` loads `/api/m.php/s` (the tracking script, copied from Plausible and kept for a day) and sends events to `/api/m.php/e`.
- `m.php` forwards each event unchanged to Plausible together with the visitor's address and browser, because Plausible needs them to count unique visitors. It limits each visitor network to 200 events per hour.
- Set `PLAUSIBLE_SCRIPT_URL` (the `https://plausible.io/js/pa-XXXXX.js` address shown in Plausible's installation snippet) in the server `.env` to switch it on. Leave it out locally and the script is an empty file, so nothing is tracked in development.
- Only pageviews are tracked by the code. Optional measurements such as outbound links can be switched on in the Plausible site settings.
- To check the installation, set `PLAUSIBLE_DEBUG=1`, post a test event to `/api/m.php/e` with `curl`, and make sure the address in the answer is yours and not your host's. Remove the setting afterwards.

If you add or remove analytics, update the `about.privacy` texts in `src/locales/en.js`, `fr.js` and `de.js`.

## Progressive web app and iOS assets

The app is a PWA built with `vite-plugin-pwa` (`registerType: 'prompt'`): it can be installed, and updates are never applied silently. When the browser finds a new service worker, it installs and waits; the app then shows a notice in the header with a **Reload** button. One tap switches to the new version with a single reload. The notice can be dismissed and returns on the next page load. The app looks for updates when it comes back to the foreground and at most once an hour while it stays open. An open atlas, point query or playback is never interrupted: the new version only activates through the button. If every tab of the site is closed while an update waits, the new version simply activates for the next visit. When the update is applied in one tab, the other open tabs are offered their reload on the next look at the app.

- Icons live in `public/app-icons/` (`icon.svg`, `icon-192.png`, `icon-512.png`, `icon-512-maskable.png`, `apple-touch-icon.png`).
- The service worker pre-caches the app files, caches atlas data and OpenStreetMap and OpenSeaMap tiles at runtime, caches per-atlas downloads (see [Offline atlases](#offline-atlases)), and never answers `/api` or `/atlas` navigations with the app shell.
- iOS needs launch images for each device size. `make ios-assets` draws the icon centred on the app's background colour (`#102D42`) for 22 device sizes in both orientations, writes the 44 images to `public/splash/` and writes the matching `<link rel="apple-touch-startup-image">` lines to `scripts/ios-splash-links.html` for pasting into `index.html`. Re-run it only when the icon, the colour or the device list change. Use `ICON=` and `MASKABLE=` to pick other files. The splash images are excluded from the offline cache.

## Offline atlases

Each atlas can be downloaded explicitly from **About → Offline atlases**, so an area can be prepared before leaving port. One row per atlas shows its size in MB and its state (*not downloaded*, *n of m frames*, *downloaded*).

- **Download** is a two-tap button: the first tap shows the exact size (computed from the grid), the second starts. Storage persistence is requested with the download, and a warning appears when the browser reports less free space than the atlas needs.
- An interrupted or partly failed download stays usable: every finished frame is kept, the row shows **n of m frames**, and **Finish download** fetches only the missing ones. **Remove** deletes the frames of that atlas again. The state is always read back from the browser cache, so an eviction or wipe can never leave a wrong "downloaded" behind.
- Offline, a downloaded atlas behaves like online. The **tide curve needs the network**: enter the reference high water by hand under **Tide data** (the app points this out on the map when the tide is missing). If a moment's frames are missing anyway, the app says so on the map and marks retained arrows as stale instead of passing them off as current.
- **Map tiles are not downloaded.** The OpenStreetMap tile policy forbids offline use and bulk downloads; only tiles already viewed are cached, and offline the arrows are drawn on a dark background. The tide data of the reference port is not cached either (the manual tide is the offline fallback).
- **Storage limits:** the browser may evict best-effort data under storage pressure, and Safari deletes the storage of a site it was not used with for a week — installing the app on the home screen exempts it from that rule, which the app suggests after a download. Storage persistence is requested with every download; Firefox asks the user, Chrome and Safari decide automatically.
- The frame cache holds at most 4000 entries with a year-long age limit (see the comment in `vite.config.js`); downloaded frames are written by the page and are not tracked by that limit. The offline wording lives in the `offline.*` keys of `src/locales/`.

## Deployment

The site runs on ordinary shared hosting, deployed by FTP with `lftp` (explicit or implicit TLS, certificate checking on by default).

```bash
make deploy-dry    # preview: app, api and atlas, nothing uploaded
make deploy        # build and upload the app; asks first
make deploy-all    # app, tide proxy and atlas data
make deploy DEPLOY_FLAGS="--no-build --yes"
```

What the script does:

- **app:** builds, uploads new files first, `index.html`, `sw.js`, `registerSW.js` and the manifest last, then removes outdated files. It never deletes `api`, `atlas`, `cache`, `cgi-bin`, `.well-known`, `.htaccess`, `.htpasswd` or any names listed in `FTP_KEEP`.
- **api:** uploads `public_html/api`, but never `.env*` files, `cache/` or `*.local.php`.
- **atlas:** uploads the data first and `index.json` last, so visitors never see an index that points to missing files.
- **Flags:** `--dry-run`, `--no-build`, `--prune` (also delete remote files that no longer exist locally in `api/` and `atlas/`) and `--yes` (no confirmation).

Before the first deployment:

1. Create `.env.deploy` from `.env.deploy.example`.
2. Put a `.env` with `MAREE_API_KEY` (and optionally `PLAUSIBLE_SCRIPT_URL`) above the document root on the server.
3. Make sure the cache folder is writable by the web server user.
4. Upload the atlas data once with `make deploy-all`.

After a deployment, an open tab shows the update notice on its next check (returning to the tab or within an hour), and one tap on **Reload** brings it to the new version.

One-time transition: visitors whose browser still holds the previous service worker (from the old silent-update mode) keep seeing the old version, because that worker serves the old files and the new one waits while any tab is open. Closing the site's last tab lets the new worker take over; from the next visit on, the notice works as described. When testing locally right after switching to this version, close all tabs of the site once (or unregister the service worker in the browser DevTools) before repeating the update test.

To test an update locally: build and open the site (`make build`, then `http://localhost/` from the webserver container), change something visible — for example a text in `src/locales/en.js` — run `make build` again, and switch away from the tab and back. The notice appears; **Reload** shows the changed text. A first-ever visit (no service worker yet) shows no notice, and nothing changes on screen until the notice is used.

Test against `http://localhost/`, not the container's self-signed `https://` — the two are separate origins with separate service workers, and Chromium restricts service workers on sites with certificate errors. The About dialog shows the git commit of the running build, so commit before you build to see it change.

## Versioning

The version lives in `package.json` and follows semantic versioning. It is shown, together with the short git commit, at the bottom of the About dialog.

```bash
make bump               # 0.1.0 -> 0.1.1, commit and tag v0.1.1
make bump BUMP=minor    # 0.1.1 -> 0.2.0
make deploy
git push --follow-tags
```

`make bump` uses `npm version` and refuses to run with uncommitted changes. The commit hash comes from git at build time, so commit before you build.

## Testing

```bash
make test        # or: npm test
```

Tests use Node's built-in runner (`node --test "src/**/*.test.js"`; `npm test` sets `TZ=UTC`). The logic that decides what is shown at a given slider position (`session.js`, `tide-plan.js`, `timeline.js`) has no DOM, no Alpine and no network access, so it can be tested directly. The URL hash helpers in `url-state.js` are pure in the same way, and the update prompt rules in `update-flow.js` take the service worker and `location.reload` as injected adapters, so every notice, takeover and reload decision is covered without a browser.

The browser acceptance suites in `test/browser/` go further: they run the served production build in a headless Firefox with the Docker webserver and check the real service worker, Cache Storage and rendered DOM — `test/browser/run.sh acceptance` for the download flow and offline navigation, `test/browser/run.sh acceptance-offline` for the offline-unavailability cases. See `test/browser/README.md` for prerequisites.

## Privacy

- No cookies and no accounts.
- Settings (language, arrow detail, time zone, last atlas, number of days of use for one support hint) and cached tide data are stored in your browser.
- Tide requests go to this site's server, which forwards them to api-maree.fr. A hashed form of the visitor's IP address is kept for a few hours to enforce usage limits.
- Visits are counted with Plausible Analytics through the proxy (see above). Plausible stores no IP address and no persistent identifier.
- Map tiles are loaded directly from the OpenStreetMap and OpenSeaMap servers, which therefore see the visitor's IP address.
- The support link opens ko-fi.com in a new tab; nothing is sent there before the click.

## Data and licences

**Code.** The source code of this project is released under the [MIT License](LICENSE). Its dependencies (Alpine.js, Leaflet, netcdfjs, Vite, Tailwind CSS and others) keep their own licences.

**Data.** The MIT licence covers the code only. The data shown by the app has its own terms:

- **Tidal currents:** Shom, Service hydrographique et océanographique de la Marine, *Atlas de courants de marée 2D au format NetCDF*, published under the Licence Ouverte 2.0 Etalab (DOI 10.17183/ATLAS_COURANTS_2D_NETCDF). The atlas files are converted to a compact binary format, interpolated between the two published coefficient cases and aligned to the high or low water of the reference port. Shom is not responsible for these modifications, and this application is independent and not endorsed by Shom, Ifremer or api-maree.fr.
- **Tide times and heights:** data provided by [api-maree.fr](https://api-maree.fr/) under CC BY, calculated from harmonic components by Ifremer / PREVIMER, also under CC BY. Please read the api-maree.fr terms of use before running your own instance, and use your own API key.
- **Map:** © OpenStreetMap contributors; seamarks © OpenSeaMap contributors.

## Author

Built by [Tommy Schmucker](https://tommyschmucker.de/), sailing on SV Tiamat ([sailingpathways.com](https://sailingpathways.com/)). Contact: current-viewer@tommyschmucker.de. The viewer is free; a small tip via Ko-fi towards development and hosting is welcome, but it is not a payment for the Shom or api-maree.fr data.
