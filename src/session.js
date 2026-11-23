import { formatClock, formatTime } from './clock.js';
import { englishI18n } from './locales/index.js';
import { dataQuality } from './data-quality.js';
import { planBlend, planFrame } from './tide-plan.js';
import { buildWave, cursorPosition, heightAt, levelScale, nextExtremum } from './timeline.js';

const pad = (n) => String(n).padStart(2, '0');

// Offset from the reference tide, e.g. "+1:30".
function formatTideOffset(minutes) {
  if (minutes === 0) return '±0:00';
  const sign = minutes < 0 ? '−' : '+';
  const abs = Math.abs(minutes);
  return `${sign}${Math.floor(abs / 60)}:${pad(abs % 60)}`;
}

const EMPTY_TIDE = { events: [], extrema: [], levels: [] };

// Holds one parsed atlas plus its tide data and answers: what is shown at a given time?
// No Alpine, no DOM, no network. i18n supplies { language, t(key, params), number(value, digits) };
// it is read at every call, so a language change shows up in the next snapshot.
export function createSession(model, { i18n = englishI18n } = {}) {
  let tide = EMPTY_TIDE;
  let scale = null;
  let wave = null;

  const tideName = (type) => i18n.t(type === 'LW' ? 'tide.lw' : 'tide.hw');

  function referenceName() {
    return model.reference
      ? `${tideName(model.reference.type)} ${model.reference.port}`
      : i18n.t('session.referenceTide');
  }

  // The curve of the visible window, drawn on the scale of all loaded levels.
  function waveFor(window) {
    if (!tide.levels.length) return null;
    return buildWave(
      tide.levels,
      tide.extrema,
      window.startMs,
      window.endMs,
      window.offsetMinutes ?? 0,
      scale,
      i18n.language
    );
  }

  function readout(targetMs, window, windowWave) {
    const offset = window.offsetMinutes ?? 0;
    const height = tide.levels.length ? heightAt(tide.levels, targetMs) : null;

    let heightLabel = '';
    if (height !== null) {
      const later = heightAt(tide.levels, targetMs + 6e5);
      const arrow = later === null ? '' : later > height ? ' ↑' : ' ↓';
      heightLabel = `${i18n.number(height, 2)} m${arrow}`;
    }

    const next = nextExtremum(tide.extrema, targetMs);
    const nextLabel = next
      ? i18n.t('session.next', {
          type: tideName(next.type === 'PM' ? 'HW' : 'LW'),
          time: formatTime(next.at.getTime(), offset),
          height: i18n.number(next.height, 2),
        })
      : '';

    return {
      heightLabel,
      nextLabel,
      cursor: cursorPosition(window.startMs, window.endMs, targetMs, windowWave, height),
    };
  }

  function describe(plan, blend, offset) {
    const coef = Number.isFinite(plan.event.coef)
      ? i18n.t('session.coef', { value: plan.event.coef })
      : i18n.t('session.coefUnknown');
    const mix =
      blend.low === blend.high
        ? ''
        : i18n.t('session.mix', { percent: Math.round(blend.weight * 100) });
    const edge = plan.clamped ? i18n.t('session.edge') : '';

    return `${referenceName()} ${formatTime(plan.event.at.getTime(), offset)} (${formatTideOffset(plan.offset)}) · ${coef}${mix}${edge}`;
  }

  // The draw for a moment, without the tide curve or a visible window.
  function drawAt(targetMs) {
    const plan = planFrame(model, tide.events, new Date(targetMs));
    if (!plan) return null;

    const blend = planBlend(model.coeffs, plan.event.coef);
    return { frame: plan.frame, low: blend.low, high: blend.high, weight: blend.weight };
  }

  // Tidal atlases: what is shown at a point in time.
  // window: { startMs, endMs, stepMinutes, offsetMinutes }
  function snapshotAt(targetMs, window) {
    const offset = window.offsetMinutes ?? 0;
    const target = new Date(targetMs);

    wave = waveFor(window);
    const draw = drawAt(targetMs);
    const base = {
      clockLabel: formatClock(targetMs, offset, i18n.language),
      wave,
      ...readout(targetMs, window, wave),
    };

    if (!draw) {
      return { ...base, detail: i18n.t('session.waiting'), draw: null };
    }

    const plan = planFrame(model, tide.events, target);
    const blend = planBlend(model.coeffs, plan.event.coef);

    return {
      ...base,
      detail: describe(plan, blend, offset),
      draw,
      quality: dataQuality({
        weight: blend.weight,
        low: Math.min(...model.coeffs),
        high: Math.max(...model.coeffs),
        coefAssumed: !Number.isFinite(plan.event.coef),
      }),
    };
  }

  return {
    model,
    reference: model.reference,
    isTidal: model.tidal,

    get referenceName() {
      return referenceName();
    },

    get wave() {
      return wave;
    },

    // Read-only view of the reference port's high and low waters (see tide-jump.js).
    get tideExtrema() {
      return tide.extrema;
    },

    sliderConfig(spanDays) {
      // The atlas's own time step in minutes: tidal atlases space their frames
      // around the reference tide (offsets in minutes), others carry real times.
      // An atlas without a readable step falls back to 60 minutes.
      let stepMinutes = 60;
      if (model.tidal && model.timeCount > 1 && model.offsets[0] !== model.offsets[1]) {
        stepMinutes = Math.abs(model.offsets[1] - model.offsets[0]);
      } else if (!model.tidal && model.times[0] && model.times[1]) {
        stepMinutes = Math.round(Math.abs(model.times[1] - model.times[0]) / 6e4);
      }

      return model.tidal
        ? { stepMinutes, sliderMax: Math.round((spanDays * 1440) / stepMinutes) }
        : { stepMinutes, sliderMax: model.timeCount - 1 };
    },

    // window is optional: the viewer draws the curve per window through snapshotAt().
    setTide(data, window) {
      tide = { events: data.events, extrema: data.extrema, levels: data.levels };
      scale = levelScale(data.levels);
      wave = window ? waveFor(window) : null;
      return wave;
    },

    clearTide() {
      tide = EMPTY_TIDE;
      scale = null;
      wave = null;
    },

    snapshotAt,
    drawAt,

    // Slider position: index steps from the start of the window (non-tidal series and older callers).
    snapshot(index, window) {
      if (!model.tidal) {
        const time = model.times[index];

        return {
          clockLabel: time
            ? time.toISOString().replace(':00.000Z', 'Z').replace('T', ' ')
            : 'No time axis',
          heightLabel: '',
          nextLabel: '',
          cursor: { x: 0, y: null },
          detail: '',
          wave: null,
          draw: { frame: index, low: 0, high: 0, weight: 0 },
        };
      }

      return snapshotAt(window.startMs + index * window.stepMinutes * 6e4, window);
    },
  };
}
