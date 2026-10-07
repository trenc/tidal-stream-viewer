const BASE = '/atlas';

export async function loadAtlasIndex() {
  const response = await fetch(`${BASE}/index.json`);
  if (!response.ok) {
    throw new Error(`Atlas list not available (HTTP ${response.status}).`);
  }

  const body = await response.json();
  return body.atlases ?? [];
}

// Downloads one atlas, reporting progress from 0 to 1.
export async function downloadAtlas(entry, onProgress) {
  const response = await fetch(`${BASE}/${encodeURIComponent(entry.file)}?v=${entry.version}`);
  if (!response.ok) {
    throw new Error(`Could not download ${entry.file} (HTTP ${response.status}).`);
  }

  if (!response.body) return response.arrayBuffer();

  const reader = response.body.getReader();
  const chunks = [];
  let received = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    onProgress?.(Math.min(received / entry.size, 1));
  }

  const buffer = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.length;
  }

  return buffer.buffer;
}
