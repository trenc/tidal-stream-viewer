// Tide data comes from our own server (public_html/api/tides.php), which holds the
// api-maree.fr key, validates requests and caches the answers. No key reaches the browser.

const KEYS = {
  sites: 'tides.sites',
  cache: 'tides.cache.',
};

// Settings of earlier versions, when the key was typed into the page.
const LEGACY_KEYS = ['tides.apiBase', 'tides.apiKey'];

const CACHE_MS = 24 * 60 * 60 * 1000;
const DAY_MS = 864e5;

// One request may return 1500 heights at most: 9 days of 10-minute levels is 1296.
const LEVEL_CHUNK_DAYS = 9;

export const API_BASE = '/api/tides.php';

// api-maree.fr asks for its attribution and status notice to be shown wherever its data is used.
const DEFAULT_ATTRIBUTION =
  'Données de marée fournies par api-maree.fr sous licence CC BY, calculées à partir de composantes harmoniques Ifremer / PREVIMER, elles-mêmes sous licence CC BY.';
const DEFAULT_NOTICE =
  'L’utilisation et l’interprétation des données relèvent de la responsabilité de l’utilisateur.';

export class TideApiError extends Error {}

if (typeof localStorage !== 'undefined') {
  LEGACY_KEYS.forEach((key) => localStorage.removeItem(key));
}

function clearCache() {
  Object.keys(localStorage)
    .filter((key) => key.startsWith(KEYS.cache))
    .forEach((key) => localStorage.removeItem(key));
}

function readJson(key) {
  try {
    return JSON.parse(localStorage.getItem(key));
  } catch {
    return null;
  }
}

async function cached(key, load) {
  const storageKey = KEYS.cache + key;
  const hit = readJson(storageKey);

  if (hit && Date.now() - hit.fetchedAt < CACHE_MS) return hit.value;

  const value = await load();

  try {
    localStorage.setItem(storageKey, JSON.stringify({ fetchedAt: Date.now(), value }));
  } catch {
    clearCache();
  }

  return value;
}

// The API sends its credits as HTML with links; the page shows them as plain text.
function plainText(html) {
  return String(html ?? '')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:])/g, '$1')
    .trim();
}

function creditsOf(body) {
  const source = body?.source ?? {};

  return {
    attribution: plainText(source.attribution || body?.attribution) || DEFAULT_ATTRIBUTION,
    statusNotice: plainText(source.status_notice || body?.status_notice) || DEFAULT_NOTICE,
  };
}

function normalise(text) {
  return String(text)
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function addDays(day, amount) {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function toUtcInput(date) {
  return date.toISOString().slice(0, 16);
}

async function request(path, params) {
  const url = `${API_BASE}${path}?${new URLSearchParams(params)}`;

  let response;
  try {
    response = await fetch(url);
  } catch {
    throw new TideApiError('Could not reach the tide service (offline?). Enter the tide time manually.');
  }

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    const detail = body?.error || body?.message || body?.code;
    throw new TideApiError(detail ? `Tide API: ${detail}` : `Tide API returned HTTP ${response.status}.`);
  }

  if (body === null) {
    throw new TideApiError('The tide service returned an unexpected answer. Is the server running?');
  }

  return body;
}

async function loadSites() {
  const cachedSites = readJson(KEYS.sites);
  if (cachedSites?.length) return cachedSites;

  const body = await request('/sites', {});
  const sites = body?.sites ?? [];
  localStorage.setItem(KEYS.sites, JSON.stringify(sites));
  return sites;
}

export async function findSite(portName) {
  const sites = await loadSites();
  const wanted = normalise(portName);

  return (
    sites.find((site) => normalise(site.site_name) === wanted) ??
    sites.find((site) => normalise(site.site_name).startsWith(wanted)) ??
    null
  );
}

// High and low waters for whole UTC days fromDay..toDay (inclusive).
export async function fetchExtrema(site, fromDay, toDay) {
  const result = await cached(`extrema.${site.site_id}.${fromDay}.${toDay}`, async () => {
    const body = await request('/tide-extrema', {
      site: site.site_id,
      from: fromDay,
      to: toDay,
      tz: 'UTC',
    });

    const events = (body?.data ?? []).flatMap((entry) =>
      (entry.extrema ?? []).map((extremum) => ({
        type: extremum.type,
        height: extremum.height,
        coef: extremum.coef ?? null,
        at: `${entry.date}T${extremum.time}:00Z`,
      }))
    );

    return { events, ...creditsOf(body) };
  });

  return {
    attribution: result.attribution,
    statusNotice: result.statusNotice ?? DEFAULT_NOTICE,
    events: result.events.map((event) => ({ ...event, at: new Date(event.at) })),
  };
}

// Whole-UTC-day windows of at most LEVEL_CHUNK_DAYS covering fromMs..toMs, as [startMs, endMs] pairs.
export function levelWindows(fromMs, toMs) {
  const first = Math.floor(fromMs / DAY_MS) * DAY_MS;
  const last = Math.ceil(toMs / DAY_MS) * DAY_MS;
  const windows = [];

  for (let start = first; start < last; start += LEVEL_CHUNK_DAYS * DAY_MS) {
    windows.push([start, Math.min(start + LEVEL_CHUNK_DAYS * DAY_MS, last)]);
  }

  return windows;
}

async function fetchLevelWindow(site, startMs, endMs, stepMinutes) {
  const fromInput = toUtcInput(new Date(startMs));
  const toInput = toUtcInput(new Date(endMs));

  const points = await cached(
    `levels.${site.site_id}.${fromInput}.${toInput}.${stepMinutes}`,
    async () => {
      const body = await request('/water-levels', {
        site: site.site_id,
        from: fromInput,
        to: toInput,
        step: stepMinutes,
        tz: 'UTC',
      });

      return (body?.data ?? []).map((point) => [Date.parse(point.time), point.height]);
    }
  );

  return points.map(([t, h]) => ({ t, h }));
}

// Water heights between two Dates. Long ranges are fetched in whole-day windows
// (a few requests, each answered and cached by the server), then joined in time order.
export async function fetchLevels(site, from, to, stepMinutes) {
  const windows = levelWindows(from.getTime(), to.getTime());
  const parts = await Promise.all(
    windows.map(([start, end]) => fetchLevelWindow(site, start, end, stepMinutes))
  );

  return parts.flat().sort((a, b) => a.t - b.t);
}
