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
