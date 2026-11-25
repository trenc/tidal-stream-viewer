// The offline download plan: which frame URLs make up an atlas, and how many
// bytes they are. The URL construction is shared with FrameStore, so a download
// writes exactly the URLs the map will request later.

// The file name of one frame, from the template in meta.json.
export function frameFile(meta, c, t) {
  return meta.frame.replace('{c}', c).replace('{t}', t);
}

// The frame URL, byte-identical for the store and the offline download.
// Older metas on disk have no "version"; the release is the same busting value for them.
export function frameUrl(meta, c, t, baseUrl = '/atlas') {
  return `${baseUrl}/${meta.id}/${frameFile(meta, c, t)}?v=${meta.version ?? meta.release ?? ''}`;
}

// Every frame of an atlas: coefficients outer, time steps inner.
export function frameUrls(meta, baseUrl) {
  const urls = [];
  for (let c = 0; c < meta.coeffs.length; c++) {
    for (let t = 0; t < meta.nt; t++) urls.push(frameUrl(meta, c, t, baseUrl));
  }
  return urls;
}

// The bytes a download writes: each frame stores u,v as int16 for every cell.
export function downloadBytes(meta) {
  return meta.nt * meta.coeffs.length * meta.nx * meta.ny * 4;
}

// Cached keys whose atlas has a known, different version: a re-converted atlas
// leaves the old ?v= URLs behind in the frame cache, and nothing else removes
// them. Keys of unknown atlases and non-atlas URLs are left alone.
export function obsoleteFrameKeys(keys, versionsById) {
  const obsolete = [];
  for (const key of keys ?? []) {
    const url = typeof key === 'string' ? key : key?.url;
    let parsed;
    try {
      parsed = new URL(url, 'https://atlas.local');
    } catch {
      continue;
    }

    const match = parsed.pathname.match(/^\/atlas\/([^/]+)\/[^/]+$/);
    if (!match) continue;
    const current = versionsById[match[1]];
    if (current !== undefined && parsed.searchParams.get('v') !== current) obsolete.push(key);
  }
  return obsolete;
}
