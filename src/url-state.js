// Shareable state in the address bar hash: atlas, map position, zoom and time marker.
// Pure functions: no DOM, no Alpine, no Leaflet.

const ATLAS_PATTERN = /^[\w.-]{1,80}$/;
// Seconds are accepted when reading a link, but links are written to whole minutes.
const TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?Z$/;

function validAtlas(value) {
  return typeof value === 'string' && ATLAS_PATTERN.test(value);
}

// What a pasted link asks of the open page: nothing, another atlas, or just view and time.
export function hashAction(state, currentAtlasId, knownAtlasIds) {
  if (!state?.atlas || !knownAtlasIds.includes(state.atlas)) return 'ignore';
  return state.atlas === currentAtlasId ? 'move' : 'open';
}

function numberOrNull(value) {
  if (value === null || value.trim() === '') return null;

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function validLat(value) {
  return value !== null && value >= -90 && value <= 90;
}

function validLon(value) {
  return value !== null && value >= -180 && value <= 180;
}

function validZoom(value) {
  return Number.isInteger(value) && value >= 0 && value <= 18;
}

// The same moment in every time zone: minutes in UTC, as YYYY-MM-DDTHH:mmZ.
function formatTime(ms) {
  if (!Number.isFinite(ms)) return null;

  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return null;

  const text = `${date.toISOString().slice(0, 16)}Z`;
  return TIME_PATTERN.test(text) ? text : null;
}

// Reads the UTC time without ever falling back to the browser's time zone.
function parseTime(value) {
  if (value === null) return null;

  const match = TIME_PATTERN.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = match[6] === undefined ? 0 : Number(match[6]);
  const ms = Date.UTC(year, month - 1, day, hour, minute, second);
  const date = new Date(ms);

  const valid =
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day &&
    date.getUTCHours() === hour &&
    date.getUTCMinutes() === minute &&
    date.getUTCSeconds() === second;

  return valid ? ms : null;
}

export function buildHash({ atlas, lat, lon, zoom, ms } = {}) {
  const parts = [];

  if (validAtlas(atlas)) parts.push(`a=${atlas}`);

  // A position only makes sense with both coordinates.
  if (Number.isFinite(lat) && validLat(lat) && Number.isFinite(lon) && validLon(lon)) {
    parts.push(`lat=${lat.toFixed(4)}`, `lon=${lon.toFixed(4)}`);
  }

  if (validZoom(zoom)) parts.push(`zoom=${zoom}`);

  const time = formatTime(ms);
  if (time !== null) parts.push(`t=${time}`);

  return `#${parts.join('&')}`;
}

export function parseHash(hash) {
  const text = String(hash ?? '');
  const params = new URLSearchParams(text.startsWith('#') ? text.slice(1) : text);
  const state = {};

  const atlas = params.get('a');
  if (validAtlas(atlas)) state.atlas = atlas;

  const lat = numberOrNull(params.get('lat'));
  const lon = numberOrNull(params.get('lon'));
  if (validLat(lat) && validLon(lon)) {
    state.lat = lat;
    state.lon = lon;
  }

  const zoom = numberOrNull(params.get('zoom'));
  if (validZoom(zoom)) state.zoom = zoom;

  const ms = parseTime(params.get('t'));
  if (ms !== null) state.ms = ms;

  return state;
}
