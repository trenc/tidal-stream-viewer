// Pure SVG helpers for a small speed curve. No DOM.

// The drawn size of the curve in the point popup; the card around it adds its own padding.
export const SPARK_WIDTH = 216;
export const SPARK_HEIGHT = 40;

// One path for the finite values; a null starts a new segment.
// values are spaced evenly, including the null gaps, so time keeps its scale.
export function sparklinePath(values, width, height, { min, max } = {}) {
  const finite = values.filter((value) => Number.isFinite(value));
  if (finite.length < 2) return '';

  const low = Number.isFinite(min) ? min : Math.min(...finite);
  const high = Number.isFinite(max) ? max : Math.max(...finite);
  const span = high - low;

  const xOf = (index) => (index / (values.length - 1)) * width;
  const yOf = (value) => (span > 0 ? height - ((value - low) / span) * height : height / 2);

  const parts = [];
  let penDown = false;

  values.forEach((value, index) => {
    if (!Number.isFinite(value)) {
      penDown = false;
      return;
    }

    parts.push(`${penDown ? 'L' : 'M'}${xOf(index).toFixed(1)} ${yOf(value).toFixed(1)}`);
    penDown = true;
  });

  return parts.join(' ');
}

export function markerX(index, count, width) {
  if (count < 2) return 0;

  const clamped = Math.min(Math.max(index, 0), count - 1);
  return (clamped / (count - 1)) * width;
}

// Labels under the curve: the strongest speed and the span it covers.
// toKnots converts m/s to the displayed unit, formatTime renders a moment in the chosen zone.
export function curveLabels(series, toKnots, formatTime) {
  const speeds = series.map((point) => point.speed).filter(Number.isFinite);
  if (speeds.length < 2) return null;

  return {
    max: toKnots(Math.max(...speeds)),
    start: formatTime(series[0].ms),
    end: formatTime(series[series.length - 1].ms),
  };
}
