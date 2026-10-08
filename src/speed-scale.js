const MS_TO_KNOTS = 1.943844;

// One fixed scale for every atlas, in knots, so a colour always means the same speed.
const STOPS = [
  { kn: 0, rgb: [96, 165, 250] },
  { kn: 1, rgb: [34, 211, 238] },
  { kn: 2, rgb: [74, 222, 128] },
  { kn: 4, rgb: [250, 204, 21] },
  { kn: 6, rgb: [248, 113, 113] },
];

export const SCALE_MAX_KN = STOPS[STOPS.length - 1].kn;

const toCss = (rgb) => `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;

export function speedColour(speedMs) {
  const kn = Math.min(speedMs * MS_TO_KNOTS, SCALE_MAX_KN);

  for (let i = 1; i < STOPS.length; i++) {
    const lower = STOPS[i - 1];
    const upper = STOPS[i];

    if (kn <= upper.kn) {
      const local = (kn - lower.kn) / (upper.kn - lower.kn);
      const channel = (n) => Math.round(lower.rgb[n] + (upper.rgb[n] - lower.rgb[n]) * local);
      return toCss([channel(0), channel(1), channel(2)]);
    }
  }

  return toCss(STOPS[STOPS.length - 1].rgb);
}

// 0..1 share of the full scale, used for the arrow length.
export function speedFraction(speedMs) {
  return Math.min((speedMs * MS_TO_KNOTS) / SCALE_MAX_KN, 1);
}

const percent = (kn) => (kn / SCALE_MAX_KN) * 100;

export const SPEED_LEGEND = {
  gradient: `linear-gradient(to right, ${STOPS.map(
    (stop) => `rgb(${stop.rgb.join(',')}) ${percent(stop.kn).toFixed(1)}%`
  ).join(', ')})`,
  ticks: STOPS.map((stop) => ({
    label: stop.kn === SCALE_MAX_KN ? `${stop.kn}+` : String(stop.kn),
    left: percent(stop.kn),
  })),
};
