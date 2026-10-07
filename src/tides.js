const KEYS = {
  base: 'tides.apiBase',
  key: 'tides.apiKey',
  sites: 'tides.sites',
  cache: 'tides.cache.',
};

const CACHE_MS = 24 * 60 * 60 * 1000;

export const DEFAULT_API_BASE = 'https://api-maree.fr';

const DEFAULT_ATTRIBUTION =
  'Données de marée fournies par api-maree.fr sous licence CC BY, calculées à partir de composantes harmoniques Ifremer / PREVIMER, elles-mêmes sous licence CC BY.';

export class TideApiError extends Error {}

function clearCache() {
  Object.keys(localStorage)
    .filter((key) => key.startsWith(KEYS.cache))
    .forEach((key) => localStorage.removeItem(key));
}

export function loadSettings() {
  return {
    apiBase: localStorage.getItem(KEYS.base) || DEFAULT_API_BASE,
    apiKey: localStorage.getItem(KEYS.key) || '',
  };
}

export function saveSettings({ apiBase, apiKey }) {
  localStorage.setItem(KEYS.base, apiBase.trim().replace(/\/+$/, '') || DEFAULT_API_BASE);
  localStorage.setItem(KEYS.key, apiKey.trim());
  localStorage.removeItem(KEYS.sites);
  clearCache();
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

async function request(path, params, settings) {
  if (!settings.apiKey) {
    throw new TideApiError('Enter your api-maree.fr API key under "Tide data" first.');
  }

  const url = new URL(settings.apiBase.replace(/\/+$/, '') + path);
  for (const [name, value] of Object.entries({ ...params, key: settings.apiKey })) {
    url.searchParams.set(name, value);
  }

  let response;
  try {
    response = await fetch(url);
  } catch {
    throw new TideApiError(
      'Could not reach the tide API (offline, wrong base URL, or blocked by CORS). Enter the tide time manually.'
    );
  }

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    const detail = body?.error || body?.message || body?.code;
    throw new TideApiError(detail ? `Tide API: ${detail}` : `Tide API returned HTTP ${response.status}.`);
  }

  return body;
}

async function loadSites(settings) {
  const cachedSites = readJson(KEYS.sites);
  if (cachedSites?.length) return cachedSites;

  const body = await request('/sites', {}, settings);
  const sites = body?.sites ?? [];
  localStorage.setItem(KEYS.sites, JSON.stringify(sites));
  return sites;
}

export async function findSite(portName, settings) {
  const sites = await loadSites(settings);
  const wanted = normalise(portName);

  return (
    sites.find((site) => normalise(site.site_name) === wanted) ??
    sites.find((site) => normalise(site.site_name).startsWith(wanted)) ??
    null
  );
}

// High and low waters for whole UTC days fromDay..toDay (inclusive).
export async function fetchExtrema(site, fromDay, toDay, settings) {
  const result = await cached(`extrema.${site.site_id}.${fromDay}.${toDay}`, async () => {
    const body = await request(
      '/tide-extrema',
      { site: site.site_id, from: fromDay, to: toDay, tz: 'UTC' },
      settings
    );

    const events = (body?.data ?? []).flatMap((entry) =>
      (entry.extrema ?? []).map((extremum) => ({
        type: extremum.type,
        height: extremum.height,
        coef: extremum.coef ?? null,
        at: `${entry.date}T${extremum.time}:00Z`,
      }))
    );

    return { events, attribution: body?.attribution || DEFAULT_ATTRIBUTION };
  });

  return {
    attribution: result.attribution,
    events: result.events.map((event) => ({ ...event, at: new Date(event.at) })),
  };
}

// Water height series between two Dates (max 1500 values per request).
export async function fetchLevels(site, from, to, stepMinutes, settings) {
  const fromInput = toUtcInput(from);
  const toInput = toUtcInput(to);

  const points = await cached(
    `levels.${site.site_id}.${fromInput}.${toInput}.${stepMinutes}`,
    async () => {
      const body = await request(
        '/water-levels',
        { site: site.site_id, from: fromInput, to: toInput, step: stepMinutes, tz: 'UTC' },
        settings
      );

      return (body?.data ?? []).map((point) => [Date.parse(point.time), point.height]);
    }
  );

  return points.map(([t, h]) => ({ t, h }));
}
