// Controller for a tapped point: the current there plus a 12 hour curve for that cell.
// Plain orchestration over the session and the frame model: no Leaflet, no Alpine, no fetch.

import { drawGroups, pointAt, seriesDraws, seriesTimes } from './point-series.js';

const SERIES_HOURS = 12;
const SERIES_STEP_MINUTES = 60;

const EMPTY = { current: null, maxSpeed: null, series: [] };

export function createPointQuery({
  getModel,
  getSession,
  getDepth,
  getCenterMs,
  loadFrames,
  t,
  curve = true,
}) {
  let request = 0;

  // Returns the result for this click, or null when a newer click has replaced it.
  // onUpdate reports the current as soon as it is known, then the curve's progress.
  async function query(latlng, onUpdate) {
    const mine = ++request;
    const isCurrent = () => mine === request;
    const model = getModel();
    const cell = model.cellAt(latlng.lat, latlng.lng);

    const outside = { status: 'outside', ...EMPTY };
    if (!cell) {
      onUpdate?.(outside);
      return outside;
    }

    const session = getSession();
    const depth = getDepth();
    const times = seriesTimes(getCenterMs(), SERIES_HOURS, SERIES_STEP_MINUTES);
    const groups = drawGroups(seriesDraws(session, times));

    const noTide = { status: 'noTide', ...EMPTY };
    if (!groups.length) {
      onUpdate?.(noTide);
      return noTide;
    }

    // One group per distinct draw: each group's entries are read right after its frames
    // arrive, so a small frame cache cannot evict the frames of the finished series.
    const series = new Array(times.length).fill(null);

    try {
      for (const [index, { draw, indexes }] of groups.entries()) {
        if (!isCurrent()) return null;

        await loadFrames([draw], isCurrent);
        if (!isCurrent()) return null;

        for (const i of indexes) {
          series[i] = pointAt(times[i], draw, model, cell, depth);
        }

        if (index === 0) {
          const current = series[0];
          if (current.speed === null) {
            // Land stays land for every time: no point in loading the rest of the curve.
            const land = { status: 'land', ...EMPTY };
            onUpdate?.(land);
            return land;
          }

          onUpdate?.({ ...EMPTY, status: 'current', current });
          if (!curve) return { ...EMPTY, status: 'current', current };
        }

        onUpdate?.({ status: 'curve', current: series[0], done: index + 1, total: groups.length });
      }
    } catch {
      if (!isCurrent()) return null;
      return { status: 'error', message: t('point.error'), ...EMPTY };
    }

    if (!isCurrent()) return null;

    const speeds = series.map((point) => point.speed).filter((speed) => speed !== null);

    return {
      status: 'ready',
      current: series[0],
      maxSpeed: speeds.length ? Math.max(...speeds) : null,
      series,
    };
  }

  return {
    query,

    // Stops the loads of the running query; used when the popup closes.
    cancel() {
      request++;
    },
  };
}
