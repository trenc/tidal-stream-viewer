import assert from 'node:assert/strict';
import { test } from 'node:test';

const storage = new Map([['tides.apiKey', 'secret'], ['tides.apiBase', 'https://example.org']]);
globalThis.localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: (key) => storage.delete(key),
};

const { TideApiError, fetchExtrema, fetchLevels, findSite, levelWindows } = await import('./tides.js');

const reply = (body, status = 200) => ({ ok: status < 400, status, json: async () => body });
const site = { site_id: 'brest', site_name: 'Brest' };
const DAY = 864e5;

const HTML_CREDITS =
  'Données de marée fournies par <a href="https://api-maree.fr/">api-maree.fr</a>\nsous licence <a href="x">CC BY</a>\n, calculées';
const PLAIN_CREDITS = 'Données de marée fournies par api-maree.fr sous licence CC BY, calculées';

test('a key stored by an earlier version is removed from the browser', () => {
  assert.equal(storage.has('tides.apiKey'), false);
  assert.equal(storage.has('tides.apiBase'), false);
});

test('requests go to the proxy and carry no key', async () => {
  const urls = [];
  globalThis.fetch = async (url) => {
    urls.push(url);
    if (url.includes('/sites')) return reply({ sites: [site] });
    return reply({
      data: [{ date: '2026-10-08', extrema: [{ type: 'PM', time: '05:12', height: 6.1, coef: 80 }] }],
      source: { attribution: HTML_CREDITS, status_notice: 'Notice.' },
    });
  };

  assert.deepEqual(await findSite('brest'), site);

  const result = await fetchExtrema(site, '2026-10-07', '2026-10-09');
  assert.equal(result.events[0].at.toISOString(), '2026-10-08T05:12:00.000Z');

  assert.ok(urls[0].startsWith('/api/tides.php/sites'));
  assert.ok(urls[1].startsWith('/api/tides.php/tide-extrema?'));
  assert.ok(urls[1].includes('site=brest'));
  assert.ok(urls.every((url) => !url.includes('key=')));
});

test('the error text of the proxy is shown', async () => {
  globalThis.fetch = async () => reply({ error: 'quota used up' }, 429);

  await assert.rejects(
    fetchExtrema(site, '2026-10-01', '2026-10-02'),
    (error) => error instanceof TideApiError && /quota used up/.test(error.message)
  );
});

test('an answer that is not JSON is reported as a server problem', async () => {
  globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => { throw new Error('not json'); } });

  await assert.rejects(fetchExtrema(site, '2026-10-03', '2026-10-04'), /unexpected answer/);
});

test('an unreachable server gives a hint to use the manual tide', async () => {
  globalThis.fetch = async () => { throw new TypeError('network'); };

  await assert.rejects(fetchExtrema(site, '2026-10-05', '2026-10-06'), /manual/);
});

test('attribution and status notice of the API are kept as plain text', async () => {
  globalThis.fetch = async () =>
    reply({ data: [], source: { attribution: HTML_CREDITS, status_notice: '<b>Notice.</b>' } });

  const result = await fetchExtrema(site, '2026-10-10', '2026-10-11');
  assert.equal(result.attribution, PLAIN_CREDITS);
  assert.equal(result.statusNotice, 'Notice.');
});

test('the mandatory texts fall back to defaults when the API sends none', async () => {
  globalThis.fetch = async () => reply({ data: [] });

  const result = await fetchExtrema(site, '2026-10-12', '2026-10-13');
  assert.match(result.attribution, /api-maree\.fr/);
  assert.match(result.statusNotice, /responsabilité de l’utilisateur/);
});

test('long ranges are split into whole-day windows of at most 9 days', () => {
  const from = Date.UTC(2026, 9, 5, 10, 0);
  const to = Date.UTC(2026, 9, 23, 6, 0);
  const windows = levelWindows(from, to);

  assert.equal(windows.length, 3);
  assert.equal(windows[0][0], Date.UTC(2026, 9, 5));
  assert.equal(windows[windows.length - 1][1], Date.UTC(2026, 9, 24));

  windows.forEach(([start, end], i) => {
    assert.ok(end - start <= 9 * DAY);
    if (i > 0) assert.equal(start, windows[i - 1][1]);
  });

  assert.equal(levelWindows(Date.UTC(2026, 9, 5), Date.UTC(2026, 9, 23)).length, 2);
});

test('levels from several windows are joined in time order', async () => {
  const urls = [];
  globalThis.fetch = async (url) => {
    urls.push(url);
    const from = new URL(url, 'http://localhost').searchParams.get('from');
    const start = Date.parse(`${from}:00Z`);
    return reply({
      data: [
        { time: new Date(start).toISOString(), height: 1 },
        { time: new Date(start + 600e3).toISOString(), height: 2 },
      ],
    });
  };

  const levels = await fetchLevels(site, new Date(Date.UTC(2026, 9, 5, 10)), new Date(Date.UTC(2026, 9, 23, 6)), 10);

  assert.equal(urls.length, 3);
  assert.ok(urls.every((url) => url.startsWith('/api/tides.php/water-levels?') && !url.includes('key=')));
  assert.equal(levels.length, 6);
  assert.deepEqual(levels.map((point) => point.t), [...levels.map((point) => point.t)].sort((a, b) => a - b));
});
