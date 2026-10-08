// Loads and caches converted current frames (Int16, interleaved u,v, rows south to north).
export class FrameStore {
  constructor({ baseUrl = '/atlas', fetchFn = (...args) => fetch(...args), maxFrames = 48 } = {}) {
    this.baseUrl = baseUrl;
    this.fetch = fetchFn;
    this.maxFrames = maxFrames;
    this.loaded = new Map();
    this.pending = new Map();
  }

  async meta(id, version = '') {
    const url = `${this.baseUrl}/${id}/meta.json?v=${version ?? ''}`;
    const response = await this.fetch(url);
    const type = response.headers?.get?.('content-type') ?? 'application/json';

    // Vite's dev server answers unknown paths with index.html and status 200.
    if (!response.ok || !type.includes('json')) {
      throw new Error(`Atlas ${id} not found at ${url}. Check that the converter output is in atlas/${id}/.`);
    }
    return response.json();
  }

  key(meta, c, t) {
    return `${meta.id}/${c}/${t}`;
  }

  // Pure lookup, safe to call for every grid cell.
  peek(meta, c, t) {
    return this.loaded.get(this.key(meta, c, t));
  }

  // Lookup that marks the frame as recently used.
  use(meta, c, t) {
    const key = this.key(meta, c, t);
    const frame = this.loaded.get(key);
    if (frame) this.#remember(key, frame);
    return frame;
  }

  load(meta, c, t) {
    const frame = this.use(meta, c, t);
    if (frame) return Promise.resolve(frame);

    const key = this.key(meta, c, t);
    if (!this.pending.has(key)) {
      const request = this.#fetchFrame(meta, c, t)
        .then((data) => {
          this.#remember(key, data);
          return data;
        })
        .finally(() => this.pending.delete(key));
      this.pending.set(key, request);
    }

    return this.pending.get(key);
  }

  async #fetchFrame(meta, c, t) {
    const file = meta.frame.replace('{c}', c).replace('{t}', t);
    const url = `${this.baseUrl}/${meta.id}/${file}?v=${meta.release ?? ''}`;
    const response = await this.fetch(url);
    if (!response.ok) {
      throw new Error(`Frame ${file} not available (HTTP ${response.status}).`);
    }

    const buffer = await response.arrayBuffer();
    const expected = meta.nx * meta.ny * 4;
    if (buffer.byteLength !== expected) {
      throw new Error(`Frame ${file} has ${buffer.byteLength} bytes, expected ${expected}. Wrong path or stale file?`);
    }

    return new Int16Array(buffer);
  }

  #remember(key, frame) {
    this.loaded.delete(key);
    this.loaded.set(key, frame);
    while (this.loaded.size > this.maxFrames) {
      this.loaded.delete(this.loaded.keys().next().value);
    }
  }
}
