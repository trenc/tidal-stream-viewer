// Messages shown above the map: a text key plus values, turned into text only
// when displayed, so they appear in the right language even after the user
// switches language. No Alpine, no DOM.

import { TideApiError } from './tides.js';

export class Msg {
  constructor(key, params = {}) {
    this.key = key;
    this.params = params;
  }
}

export const msg = (key, params) => new Msg(key, params);

// An error becomes the message to show. Tide errors carry their own key and values.
export function errorMessage(error) {
  if (error instanceof TideApiError && error.code) return msg(`tideError.${error.code}`, error.params);
  return msg('error.raw', { text: error.message });
}

// Like errorMessage, but recognises unsupported NetCDF files first.
export function explain(error) {
  if (isNetworkError(error)) return msg('offline.atlas');
  if (/valid NetCDF|magic|version/i.test(error.message)) return msg('error.unsupported');
  return errorMessage(error);
}

// A fetch that could not reach the network. Browsers reject such fetches
// with a TypeError (Chrome: "Failed to fetch", Firefox: "NetworkError…",
// Safari: "Load failed"). navigator.onLine is not consulted: it is false for
// any interface loss and true does not guarantee connectivity.
export function isNetworkError(error) {
  return error instanceof TypeError;
}

// What to say when frames of an open atlas fail to load offline. A partial
// download is the one cause the user can fix themselves.
export function offlineFrames(state) {
  return state === 'partial' ? msg('offline.framesPartial') : msg('offline.frames');
}

// The status line after tide data arrived, or null when everything is fine.
// A failed levels request still leaves the extrema usable, so it is a warning.
export function tideStatus(data) {
  if (data.levelsError) return msg('status.curveUnavailable', { message: errorMessage(data.levelsError) });
  if (!data.events.length) return msg('status.noTimes');
  return null;
}

// The status line when loading the tide data failed.
export function tideLoadStatus(error) {
  return error instanceof TideApiError
    ? errorMessage(error)
    : msg('status.tideFailed', { message: error.message });
}
