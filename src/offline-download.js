// Downloads frame URLs into the frame cache (Cache API) from the page. Frames
// already cached are skipped, so running the download again resumes where the
// last one stopped: the cache itself is the journal.

export class DownloadQuotaError extends Error {
  // The partial counts at the moment the browser refused to store more.
  constructor({ done, total, failed }) {
    super('The browser storage is full.');
    this.name = 'DownloadQuotaError';
    this.done = done;
    this.total = total;
    this.failed = failed;
  }
}

const abortError = () => {
  const error = new Error('The download was cancelled.');
  error.name = 'AbortError';
  return error;
};

export function createDownload({ openCache, fetchFn, urls, concurrency = 4, signal, onProgress }) {
  return (async () => {
    const cache = await openCache();
    let done = 0;
    let failed = 0;
    let next = 0;
    let stopped = false;

    const counts = () => ({ done, total: urls.length, failed });
    const report = () => onProgress?.(counts());
    const stop = (error) => {
      stopped = true; // the other workers start no further fetches
      throw error;
    };

    const worker = async () => {
      while (!stopped && next < urls.length) {
        if (signal?.aborted) stop(abortError());

        const url = urls[next++];

        if (await cache.match(url)) {
          done++;
          report();
          continue;
        }

        let response;
        try {
          response = await fetchFn(url, { signal });
        } catch (error) {
          if (signal?.aborted) stop(error);
          failed++;
          report();
          continue;
        }

        if (!response.ok) {
          failed++;
          report();
          continue;
        }

        if (await cache.match(url)) {
          // The service worker stored the frame while our fetch was on the way.
          response.body?.cancel?.();
          done++;
          report();
          continue;
        }

        try {
          await cache.put(url, response);
        } catch (error) {
          if (error?.name === 'QuotaExceededError') stop(new DownloadQuotaError(counts()));
          failed++;
          report();
          continue;
        }

        done++;
        report();
      }
    };

    const pool = Array.from({ length: Math.max(1, Math.min(concurrency, urls.length)) }, () => worker());
    await Promise.all(pool);
    return counts();
  })();
}
