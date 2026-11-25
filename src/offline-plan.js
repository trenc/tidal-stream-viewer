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
