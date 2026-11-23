// The ticks of the map legend: what arrow colour and length mean, in knots.
import { MS_TO_KNOTS, arrowLengthPx, speedColour } from './speed-scale.js';

// A maximum at or below this still gives a readable legend, so it is never empty.
const MIN_KN = 1;

// Tick values read better on a round step: 0.5 kn in the slow range, 1 kn above it.
const roundTick = (kn) => (kn < 4 ? Math.round(kn * 2) / 2 : Math.round(kn));

// count evenly spaced ticks from 0 to maxKnots, each carrying the colour and the
// arrow length the map uses for that speed. A zero, tiny or non-finite maximum
// falls back to MIN_KN. Equal neighbours collapse, so the ticks stay unique.
export function legendSteps(maxKnots, count = 5) {
  const top = Number.isFinite(maxKnots) ? Math.max(maxKnots, MIN_KN) : MIN_KN;
  const divisions = Math.max(count - 1, 1);

  const steps = [];
  for (let i = 0; i <= divisions; i++) {
    const knots = roundTick((top * i) / divisions);
    if (knots === steps.at(-1)?.knots) continue;

    const speedMs = knots / MS_TO_KNOTS;
    steps.push({ knots, colour: speedColour(speedMs), lengthPx: arrowLengthPx(speedMs) });
  }

  return steps;
}
