const WIDTH = 1000;
const HEIGHT = 120;
const PAD = 0.12;

function heightToPercent(min, max, height) {
  const range = max - min || 1;
  return (PAD + (1 - (height - min) / range) * (1 - 2 * PAD)) * 100;
}

// Local-midnight separators for the day labels.
export function buildAxis(startMs, endMs) {
  const span = endMs - startMs;
  const days = [];
  const day = new Date(startMs);
  day.setHours(24, 0, 0, 0);

  while (day.getTime() < endMs) {
    days.push({
      x: ((day.getTime() - startMs) / span) * 100,
      label: day.toLocaleDateString([], { weekday: 'short', day: 'numeric' }),
    });
    day.setDate(day.getDate() + 1);
  }

  return days;
}

// SVG paths (viewBox "0 0 1000 120") and marker positions (percent) for the tide wave.
export function buildWave(levels, extrema, startMs, endMs) {
  const inside = levels.filter((point) => point.t >= startMs && point.t <= endMs);
  if (inside.length < 2) return null;

  const span = endMs - startMs;
  const heights = inside.map((point) => point.h);
  const min = Math.min(...heights);
  const max = Math.max(...heights);

  const points = inside.map((point) => [
    ((point.t - startMs) / span) * WIDTH,
    (heightToPercent(min, max, point.h) / 100) * HEIGHT,
  ]);

  const line = points
    .map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`)
    .join(' ');
  const first = points[0];
  const last = points[points.length - 1];
  const area = `${line} L${last[0].toFixed(1)} ${HEIGHT} L${first[0].toFixed(1)} ${HEIGHT} Z`;

  const markers = extrema
    .filter((event) => event.at.getTime() >= startMs && event.at.getTime() <= endMs)
    .map((event) => {
      const label = event.type === 'PM' ? 'HW' : 'LW';
      const time = event.at.toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' });
      const coef = event.coef ? ` · coef ${event.coef}` : '';
      return {
        type: event.type,
        x: ((event.at.getTime() - startMs) / span) * 100,
        y: heightToPercent(min, max, event.height),
        title: `${label} ${time} · ${event.height.toFixed(2)} m${coef}`,
      };
    });

  return { min, max, line, area, markers };
}

export function cursorPosition(startMs, endMs, ms, wave, height) {
  const x = ((ms - startMs) / (endMs - startMs)) * 100;
  if (!wave || height === null) return { x, y: null };
  return { x, y: heightToPercent(wave.min, wave.max, height) };
}

export function heightAt(levels, ms) {
  if (levels.length < 2 || ms < levels[0].t || ms > levels[levels.length - 1].t) return null;

  const step = levels[1].t - levels[0].t;
  const i = Math.min(levels.length - 2, Math.floor((ms - levels[0].t) / step));
  const a = levels[i];
  const b = levels[i + 1];

  return a.h + ((b.h - a.h) * (ms - a.t)) / (b.t - a.t);
}

export function nextExtremum(extrema, ms) {
  return extrema.find((event) => event.at.getTime() > ms) ?? null;
}
