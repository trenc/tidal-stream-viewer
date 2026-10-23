# Tidal Stream Viewer

An offline-capable web app for sailors that draws the **Shom tidal stream atlases** as arrows on a map and times them against the tide of a reference port. Pick an atlas, slide through the tidal cycle, and the viewer shows the stream for the matching hour, blended between neap and spring according to the tide coefficient.

Live at <https://tidal-streams.sailingpathways.com/>. Free, no ads, no cookies. Available in English, French and German.

> **Not for navigation on its own.** Shom states that the atlases may only be used together with the official charts and nautical publications. The values shown are derived estimates, not the values published by Shom. See [Data and licences](#data-and-licences).

## Contents

- [How it works](#how-it-works)
- [Project layout](#project-layout)
- [Requirements](#requirements)
- [Quick start](#quick-start)
- [Make targets](#make-targets)
- [Configuration](#configuration)
- [Atlas data](#atlas-data)
- [Tide proxy](#tide-proxy)
- [Analytics (optional)](#analytics-optional)
- [Progressive web app and iOS assets](#progressive-web-app-and-ios-assets)
- [Deployment](#deployment)
- [Versioning](#versioning)
- [Testing](#testing)
- [Privacy](#privacy)
- [Data and licences](#data-and-licences)

## How it works

1. **Atlas data.** Shom publishes 2D tidal current atlases as NetCDF files. A converter turns them into compact binary frames plus an `index.json`, which are served as static files under `/atlas`.
2. **Tide times.** The browser asks the site's own PHP proxy for the high and low waters and the height curve of the reference port. The proxy talks to [api-maree.fr](https://api-maree.fr/), keeps the API key on the server, caches the answers and enforces usage limits.
3. **Timing the stream.** For a chosen clock time the app picks the nearest reference tide and the matching atlas frame (`src/tide-plan.js`). The atlases contain two published cases (tide coefficients 45 and 95); arrows are interpolated linearly between them. Coefficients are limited to 20 to 120, and outside 45 to 95 the values are extrapolated, which is less reliable. If a tide has no coefficient, 70 is assumed and the app says so.
4. **Offline use.** A service worker caches the app, the atlas data and the map tiles that were already loaded, so the viewer keeps working without a connection.

## Project layout

| Path | Purpose |
|---|---|
| `index.html` | The single page, including the About dialog in three languages |
| `src/` | Front-end modules: `main.js` (entry), `viewer.js` (Alpine component), `map.js` (Leaflet), `session.js`, `tide-plan.js`, `timeline.js`, `playback.js`, `tides.js` and `tide-service.js` (tide API client), `atlas.js`, `frame-store.js`, `netcdf.js`, the translations (`en`, `fr`, `de`) and `style.css` |
| `public/` | Static files copied as they are: `app-icons/`, `splash/` (iOS launch images) |
| `public_html/` | The web root served by the local container and the source of the API upload. `make build` writes the app here |
| `public_html/api/` | PHP: `tides.php` (tide proxy), `m.php` (Plausible proxy), `env.php` (settings reader) |
| `public_html/atlas/` | Converted atlas data and `index.json` (never touched by `make build`) |
| `apache/atlas.conf` | Apache settings for the atlas files, mounted into the container |
| `nc/` | The original Shom `.nc` files (input for the converter) |
| `scripts/` | `convert_atlas.py`, `make_ios_assets.py`, `deploy.sh` |
| `cache/tides/` | Local cache of the tide proxy |
| `dist/` | Vite build output (temporary) |

## Requirements

- Node.js 18 or newer and npm
- Docker with the Compose plugin. It runs the local server, the atlas converter and the iOS asset script
- `rsync` (used by `make build`) and `lftp` (used by the deploy script): `sudo apt install rsync lftp`
- An [api-maree.fr](https://api-maree.fr/) API key
- For hosting: Apache with PHP 8.1 or newer and the cURL extension, plus FTP access

`docker-compose.yml` starts a service called `php_apache` from an image named `scto-php:8.5` (Apache with PHP 8.5). That image is not on Docker Hub as far as this repository is concerned: build or tag it locally first, or change the `image:` line to any Apache and PHP image that has the cURL extension.

## Quick start

```bash
make setup      # creates folders and .env, fixes cache permissions (asks for sudo once)
# add your MAREE_API_KEY to .env
make install    # npm install
make up         # starts the Apache and PHP container (ports 80 and 443)
make convert    # put the Shom .nc files into nc/ first
make dev        # Vite dev server on http://localhost:5173/
```

In development, Vite proxies `/atlas` and `/api` to the Apache container, so the app, the atlas data and the tide proxy behave as they do in production.

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
| `dev` | Start Apache, then the Vite dev server |
| `build` | Build into `dist/` and copy into `public_html/` (keeps `atlas/` and `api/`) |
| `preview` | Preview the production build with Vite |
| `test` | Run all unit tests |
| `up`, `down`, `restart`, `logs`, `shell` | Manage the Apache container (`restart` is needed after changing `.env`) |
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

If you add or remove analytics, update the Privacy section in `index.html` (all three languages).

## Progressive web app and iOS assets

The app is a PWA built with `vite-plugin-pwa` (`registerType: 'autoUpdate'`): it can be installed, and new builds replace the old ones in the background.

- Icons live in `public/app-icons/` (`icon.svg`, `icon-192.png`, `icon-512.png`, `icon-512-maskable.png`, `apple-touch-icon.png`).
- The service worker pre-caches the app files, caches atlas data and OpenStreetMap and OpenSeaMap tiles at runtime, and never answers `/api` or `/atlas` navigations with the app shell.
- iOS needs launch images for each device size. `make ios-assets` draws the icon centred on the app's background colour (`#102D42`) for 22 device sizes in both orientations, writes the 44 images to `public/splash/` and writes the matching `<link rel="apple-touch-startup-image">` lines to `scripts/ios-splash-links.html` for pasting into `index.html`. Re-run it only when the icon, the colour or the device list change. Use `ICON=` and `MASKABLE=` to pick other files. The splash images are excluded from the offline cache.

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

After a deployment, reload the site twice so that the new service worker takes over.

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

Tests use Node's built-in runner (`node --test "src/**/*.test.js"`; `npm test` sets `TZ=UTC`). The logic that decides what is shown at a given slider position (`session.js`, `tide-plan.js`, `timeline.js`) has no DOM, no Alpine and no network access, so it can be tested directly.

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
