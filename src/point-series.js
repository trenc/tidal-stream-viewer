// Pure computation of the current at one cell over a series of times.
// No DOM, no Alpine, no Leaflet and no fetch.

import { blendedVector } from './vector-blend.js';

const MINUTE_MS = 60000;

// One timestamp every stepMinutes from startMs to startMs + hours, both ends included.
export function seriesTimes(startMs, hours, stepMinutes) {
  if (!Number.isFinite(startMs) || !Number.isFinite(hours) || !Number.isFinite(stepMinutes)) {
    return [];
  }
  if (hours < 0 || stepMinutes <= 0) return [];

  const count = Math.floor((hours * 60) / stepMinutes) + 1;
  return Array.from({ length: count }, (_, index) => startMs + index * stepMinutes * MINUTE_MS);
}

// The draw of each time, or null when there is no tide data. Callers can prefetch these.
export function seriesDraws(session, times) {
  return times.map((ms) => session.drawAt(ms));
}

// One group per distinct draw, with the indexes of the times that share it, in first-seen order.
export function drawGroups(draws) {
  const groups = [];
  const byKey = new Map();

  draws.forEach((draw, index) => {
    if (!draw) return;

    const key = `${draw.frame}:${draw.low}:${draw.high}`;
    let group = byKey.get(key);
    if (!group) {
      group = { draw, indexes: [] };
      byKey.set(key, group);
      groups.push(group);
    }
    group.indexes.push(index);
  });

  return groups;
}

// The set in degrees, measured clockwise from north.
function bearingOf(east, north) {
  return ((Math.atan2(east, north) * 180) / Math.PI + 360) % 360;
}

function emptyPoint(ms, ready) {
  return { ms, ready, east: null, north: null, speed: null, bearing: null };
}

// The current at one time from one draw. Land and missing frames give ready points without values.
export function pointAt(ms, draw, model, cell, depth) {
  if (draw === null || draw === undefined) return emptyPoint(ms, false);

  const ready = typeof model.isReady !== 'function' || model.isReady(draw);
  if (!ready) return emptyPoint(ms, false);

  const vector = blendedVector(model, { ...draw, depth }, cell.y, cell.x);
  if (!vector) return emptyPoint(ms, true);

  const [east, north] = vector;
  return {
    ms,
    ready: true,
    east,
    north,
    speed: Math.hypot(east, north),
    bearing: bearingOf(east, north),
  };
}
