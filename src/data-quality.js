// Classifies how far the current estimate leans on the atlas beyond what it published.
// weight comes straight from planBlend: it only stays within 0 and 1 while the tide
// coefficient lies between the two published cases, and is pinned to 0 when they are equal.
export function dataQuality({ weight, low, high, coefAssumed }) {
  if (coefAssumed) return 'assumed';
  if (low === high) return 'ok';
  return weight >= 0 && weight <= 1 ? 'ok' : 'extrapolated';
}
