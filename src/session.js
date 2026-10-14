import { formatClock, formatTime } from './clock.js';
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
// No Alpine, no DOM, no network.
export function createSession(model) {
  let tide = EMPTY_TIDE;
  let scale = null;
  let wave = null;

  const referenceName = model.reference
    ? `${model.reference.type} ${model.reference.port}`
    : 'reference tide';

  // The curve of the visible window, drawn on the scale of all loaded levels.
  function waveFor(window) {
    if (!tide.levels.length) return null;
    return buildWave(
      tide.levels,
      tide.extrema,
      window.startMs,
      window.endMs,
      window.offsetMinutes ?? 0,
      scale
    );
  }

  function readout(targetMs, window, windowWave) {
    const offset = window.offsetMinutes ?? 0;
    const height = tide.levels.length ? heightAt(tide.levels, targetMs) : null;

    let heightLabel = '';
    if (height !== null) {
      const later = heightAt(tide.levels, targetMs + 6e5);
      const arrow = later === null ? '' : later > height ? ' ↑' : ' ↓';
      heightLabel = `${height.toFixed(2)} m${arrow}`;
    }

    const next = nextExtremum(tide.extrema, targetMs);
    const nextLabel = next
      ? `Next ${next.type === 'PM' ? 'HW' : 'LW'} ${formatTime(next.at.getTime(), offset)} · ${next.height.toFixed(2)} m`
      : '';

    return {
      heightLabel,
      nextLabel,
      cursor: cursorPosition(window.startMs, window.endMs, targetMs, windowWave, height),
    };
  }

  function describe(plan, blend, offset) {
    const coef = Number.isFinite(plan.event.coef)
      ? `coef ${plan.event.coef}`
      : 'coef unknown, 70 assumed';
    const mix =
      blend.low === blend.high
        ? ''
        : ` → ${Math.round(blend.weight * 100)} % of the way from neap to spring`;
    const edge = plan.clamped ? ' · beyond ±6 h of this tide: showing the edge frame' : '';

    return `${referenceName} ${formatTime(plan.event.at.getTime(), offset)} (${formatTideOffset(plan.offset)}) · ${coef}${mix}${edge}`;
  }

  // Tidal atlases: what is shown at a point in time.
  // window: { startMs, endMs, stepMinutes, offsetMinutes }
  function snapshotAt(targetMs, window) {
    const offset = window.offsetMinutes ?? 0;
    const target = new Date(targetMs);

    wave = waveFor(window);
    const base = {
      clockLabel: formatClock(targetMs, offset),
      wave,
      ...readout(targetMs, window, wave),
    };

    const plan = planFrame(model, tide.events, target);
    if (!plan) {
      return { ...base, detail: 'Waiting for tide times. Check "Tide data" in the sidebar.', draw: null };
    }

    const blend = planBlend(model.coeffs, plan.event.coef);

    return {
      ...base,
      detail: describe(plan, blend, offset),
      draw: { frame: plan.frame, low: blend.low, high: blend.high, weight: blend.weight },
    };
  }

  return {
    model,
    referenceName,
    reference: model.reference,
    isTidal: model.tidal,

    get wave() {
      return wave;
    },

    sliderConfig(spanDays) {
      if (!model.tidal) {
        return { stepMinutes: 30, sliderMax: model.timeCount - 1 };
      }

      const [first, second] = model.offsets;
      const stepMinutes = model.timeCount > 1 && first !== second ? Math.abs(second - first) : 30;

      return { stepMinutes, sliderMax: Math.round((spanDays * 1440) / stepMinutes) };
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
