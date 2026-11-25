import { addDays, createTideApi, TideApiError } from './tides.js';

const utcDay = (date) => date.toISOString().slice(0, 10);

const NO_TIDE = {
  siteName: '',
  extrema: [],
  events: [],
  levels: [],
  attribution: '',
  statusNotice: '',
  levelsError: null,
};

export function createTideService(api = createTideApi()) {
  // Only the newest request may apply its data; older ones resolve to null.
  let request = 0;

  async function loadReference(reference, startMs, endMs, levelStepMinutes) {
    const site = await api.findSite(reference.port);

    if (!site) {
      throw new api.TideApiError(`No api-maree.fr site named "${reference.port}".`, 'noSite', {
        port: reference.port,
      });
    }

    const start = new Date(startMs);
    const end = new Date(endMs);

    const result = await api.fetchExtrema(
      site,
      api.addDays(utcDay(start), -1),
      api.addDays(utcDay(end), 1)
    );

    const wantedType = reference.type === 'LW' ? 'BM' : 'PM';
    const extrema = result.events;
    const events = extrema
      .filter((item) => item.type === wantedType)
      .map((item) => ({ at: item.at, coef: item.coef }));

    let levels = [];
    let levelsError = null;

    try {
      levels = await api.fetchLevels(site, start, end, levelStepMinutes);
    } catch (error) {
      levelsError = error;
    }

    return {
      siteName: site.site_name,
      extrema,
      events,
      levels,
      attribution: result.attribution,
      statusNotice: result.statusNotice,
      levelsError,
    };
  }

  return {
    // Loads high/low waters and the height curve for the window.
    // The curve is optional: a failure there is reported in levelsError.
    // A load superseded by a newer one (or by the manual tide) resolves to null.
    async load(reference, startMs, endMs, levelStepMinutes) {
      const mine = ++request;

      try {
        const data = await loadReference(reference, startMs, endMs, levelStepMinutes);
        return mine === request ? data : null;
      } catch (error) {
        if (mine !== request) return null;
        throw error;
      }
    },

    // Makes in-flight loads stale: they neither apply data nor report errors.
    cancel() {
      request++;
    },

    // Entering a manual tide supersedes the online loads.
    manual(at, coef) {
      request++;
      return { ...NO_TIDE, events: [{ at, coef }] };
    },
  };
}
