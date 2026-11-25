// The offline state of an atlas, derived from the frame cache on every look.
// No flag is stored anywhere, so an eviction, a wipe or a version change cannot
// leave a stale "downloaded" behind.
import { frameUrls } from './offline-plan.js';

export function stateOf(meta, cachedUrls) {
  const urls = frameUrls(meta);
  const cached = cachedUrls instanceof Set ? cachedUrls : new Set(cachedUrls);

  let done = 0;
  for (const url of urls) {
    if (cached.has(url)) done++;
  }

  return {
    state: done === 0 ? 'none' : done === urls.length ? 'complete' : 'partial',
    done,
    total: urls.length,
  };
}

// Cache keys are Requests with absolute URLs; frameUrl() builds relative paths.
// Both sides of a comparison become "pathname + search", which a foreign host
// cannot fake (the atlas is served by this site alone).
export function cachedFrameUrls(keys) {
  const urls = new Set();
  for (const key of keys ?? []) {
    const url = typeof key === 'string' ? key : key?.url;
    let parsed;
    try {
      parsed = new URL(url ?? '', 'https://atlas.local');
    } catch {
      continue;
    }

    if (!parsed.pathname.startsWith('/atlas/')) continue;
    urls.add(parsed.pathname + parsed.search);
  }
  return urls;
}
