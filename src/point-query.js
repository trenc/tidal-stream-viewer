// Controller for a tapped point: the current there plus a 12 hour curve for that cell.
// Plain orchestration over the session and the frame model: no Leaflet, no Alpine, no fetch.

import { pointSeries, seriesDraws, seriesTimes, uniqueDraws } from './point-series.js';

const SERIES_HOURS = 12;
const SERIES_STEP_MINUTES = 30;

const EMPTY = { current: null, maxSpeed: null, series: [] };

export function createPointQuery({ getModel, getSession, getDepth, getCenterMs, loadFrames, t }) {
  let request = 0;

  // Returns the result for this click, or null when a newer click has replaced it.
  async function query(latlng, onProgress) {
    const mine = ++request;
    const model = getModel();
    const cell = model.cellAt(latlng.lat, latlng.lng);
    if (!cell) return { status: 'outside', ...EMPTY };

    const session = getSession();
    const times = seriesTimes(getCenterMs(), SERIES_HOURS, SERIES_STEP_MINUTES);
    const draws = seriesDraws(session, times);

    try {
      const unique = uniqueDraws(draws);
      if (unique.length) await loadFrames(unique, onProgress);
    } catch {
      if (mine !== request) return null;
      return { status: 'error', message: t('point.error'), ...EMPTY };
    }

    if (mine !== request) return null;

    const series = pointSeries({ session, model, cell, times, depth: getDepth(), draws });
    const current = series[0] ?? null;
    const speeds = series.map((point) => point.speed).filter((speed) => speed !== null);

    if (!current || !current.ready) return { status: 'loading', ...EMPTY };
    if (current.speed === null) return { status: 'land', current: null, maxSpeed: null, series };

    return {
      status: 'ready',
      current,
      maxSpeed: speeds.length ? Math.max(...speeds) : null,
      series,
    };
  }

  return { query };
}
